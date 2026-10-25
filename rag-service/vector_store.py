"""Gemini + Qdrant retrieval adapter with version-safe collections and native hybrid search.

PostgreSQL remains the source of truth for users/documents/permissions. Qdrant stores
only active, authorized, versioned chunk payloads and their dense/sparse representations.
All third-party clients are imported lazily so the legacy pgvector test path stays lightweight.
"""
from __future__ import annotations

import hashlib
import logging
import math
import os
import time
import uuid
from threading import Lock
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

_COLLECTION_NAMESPACE = uuid.UUID("930f13f1-184d-4dfc-9318-25a2387c1d3f")
_CLIENT = None
_CLIENT_LOCK = Lock()
_GEMINI_CLIENT = None
_GEMINI_LOCK = Lock()
_SPARSE_MODEL = None
_SPARSE_LOCK = Lock()
_TOKENIZER = None
_TOKENIZER_LOCK = Lock()


class _TikTokenAdapter:
    """Small adapter exposing the tokenizer API used by the existing chunker."""
    def __init__(self, encoding):
        self.encoding = encoding

    def encode(self, text: str, add_special_tokens: bool = False):
        return self.encoding.encode(text, disallowed_special=())

    def decode(self, tokens, skip_special_tokens: bool = True):
        return self.encoding.decode(list(tokens))


def get_text_tokenizer():
    """Return a bounded local tokenizer for chunk sizing without loading an ML model."""
    global _TOKENIZER
    if _TOKENIZER is None:
        with _TOKENIZER_LOCK:
            if _TOKENIZER is None:
                try:
                    import tiktoken
                    encoding = tiktoken.get_encoding(os.getenv("CHUNK_TOKENIZER", "cl100k_base"))
                    _TOKENIZER = _TikTokenAdapter(encoding)
                except Exception:
                    logger.warning("tiktoken is unavailable; chunk sizing will use a word-count fallback.")
                    _TOKENIZER = False
    return _TOKENIZER if _TOKENIZER is not False else None


def _truthy(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_embedding_config() -> Tuple[str, int, str]:
    model = os.getenv("EMBEDDING_MODEL_NAME", "gemini-embedding-2").strip()
    dimension = int(os.getenv("EMBEDDING_DIMENSION", "768"))
    collection = os.getenv(
        "QDRANT_COLLECTION_NAME",
        f"ai_workspace_{model.lower().replace('-', '_').replace('.', '_')}_{dimension}_v1",
    ).strip()
    if dimension < 128 or dimension > 3072:
        raise RuntimeError("Gemini embedding dimension must be between 128 and 3072.")
    if not collection:
        raise RuntimeError("QDRANT_COLLECTION_NAME cannot be empty.")
    model_token = model.lower().replace("-", "_").replace(".", "_")
    if model_token not in collection.lower() or str(dimension) not in collection:
        raise RuntimeError(
            "QDRANT_COLLECTION_NAME must include the normalized embedding model and dimension "
            f"({model_token}_{dimension}) to prevent incompatible vectors being mixed. "
            "Choose a new versioned collection name when changing the embedding model/dimension."
        )
    return model, dimension, collection


def prepare_embedding_input(text: str, *, is_query: bool, title: Optional[str] = None,
                            model_name: Optional[str] = None) -> str:
    """Apply the documented asymmetric retrieval instructions consistently."""
    model = (model_name or get_embedding_config()[0]).strip()
    value = " ".join((text or "").split())
    if not value:
        raise ValueError("Cannot embed empty text.")
    if model == "gemini-embedding-2":
        if is_query:
            return f"task: question answering | query: {value}"
        safe_title = " ".join((title or "none").split()) or "none"
        return f"title: {safe_title} | text: {value}"
    return value


def stable_generation_id(items: Sequence[Dict[str, Any]], model_name: str) -> str:
    digest = hashlib.sha256()
    digest.update(model_name.encode("utf-8"))
    digest.update(b"|heading-paragraph-token-v3|")
    for item in items:
        digest.update(str(item.get("document_key", "")).encode("utf-8"))
        digest.update(b"|")
        digest.update(str(item.get("filename", "")).encode("utf-8"))
        digest.update(b"|")
        digest.update(str(item.get("page_number", 0)).encode("utf-8"))
        digest.update(b"|")
        digest.update(str(item.get("document_id", "")).encode("utf-8"))
        digest.update(b"|")
        digest.update(str(item.get("chunk_index", 0)).encode("utf-8"))
        digest.update(b"|")
        digest.update(str(item.get("content", "")).encode("utf-8"))
        digest.update(b"|")
        digest.update(str(item.get("user_id", "")).encode("utf-8"))
        digest.update(b"|")
        digest.update(str(item.get("college_id", "")).encode("utf-8"))
        digest.update(b"|")
        digest.update(str(bool(item.get("is_college_doc", False))).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()[:24]


def extract_heading(text: str) -> str:
    """Extract the preserved section hierarchy from a heading-prefixed chunk."""
    import re

    headings = []
    for line in (text or "").splitlines():
        value = line.strip()
        match = re.match(r"^#{1,6}\s+(.+)$", value)
        if match:
            headings.append(match.group(1).strip())
        if len(headings) >= 6:
            break
    return " > ".join(headings)


def stable_point_id(collection_name: str, document_key: str, generation_id: str,
                    chunk_index: int, content: str) -> str:
    body_hash = hashlib.sha256((content or "").encode("utf-8")).hexdigest()[:16]
    value = f"{collection_name}|{document_key}|{generation_id}|{chunk_index}|{body_hash}"
    return str(uuid.uuid5(_COLLECTION_NAMESPACE, value))


def _get_gemini_client():
    global _GEMINI_CLIENT
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key.lower() in {"replace_me", "your_api_key", "your_gemini_api_key"}:
        raise RuntimeError("Set GEMINI_API_KEY in the ignored local .env before using Gemini embeddings.")
    if _GEMINI_CLIENT is None:
        with _GEMINI_LOCK:
            if _GEMINI_CLIENT is None:
                from google import genai
                _GEMINI_CLIENT = genai.Client(api_key=api_key)
    return _GEMINI_CLIENT


def _embed_one(text: str, *, is_query: bool, title: Optional[str]) -> List[float]:
    from google.genai import types

    model_name, dimension, _ = get_embedding_config()
    prepared = prepare_embedding_input(text, is_query=is_query, title=title, model_name=model_name)
    client = _get_gemini_client()
    config_args: Dict[str, Any] = {"output_dimensionality": dimension}
    if model_name == "gemini-embedding-001":
        config_args["task_type"] = "RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT"
    config = types.EmbedContentConfig(**config_args)
    last_error = None
    attempts = max(1, min(5, int(os.getenv("GEMINI_MAX_RETRIES", "3"))))
    for attempt in range(attempts):
        try:
            result = client.models.embed_content(model=model_name, contents=prepared, config=config)
            embeddings = getattr(result, "embeddings", None) or []
            if not embeddings or not getattr(embeddings[0], "values", None):
                raise RuntimeError("Gemini returned an empty embedding.")
            vector = [float(value) for value in embeddings[0].values]
            if len(vector) != dimension or any(not math.isfinite(value) for value in vector):
                raise RuntimeError(
                    f"Gemini embedding dimension/values mismatch: expected {dimension}, received {len(vector)}."
                )
            norm = math.sqrt(sum(value * value for value in vector))
            if norm <= 0:
                raise RuntimeError("Gemini returned a zero-length embedding.")
            return [value / norm for value in vector]
        except Exception as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(min(2 ** attempt, 4))
    logger.error("Gemini embedding failed after %s attempts (%s).", attempts, type(last_error).__name__)
    raise RuntimeError(
        f"Gemini embedding request failed after {attempts} attempts. Verify the API key, model, quota and network."
    ) from last_error


def gemini_embed_texts(texts: Sequence[str], *, is_query: bool = False,
                       titles: Optional[Sequence[Optional[str]]] = None) -> List[List[float]]:
    """Embed each document/query with the configured Gemini model.

    gemini-embedding-2 aggregates multi-input embedContent requests, so this
    path submits one item per request. gemini-embedding-001 supports per-input
    vectors from a list of strings, so it uses bounded API batches.
    """
    if not texts:
        return []
    if any(not isinstance(text, str) or not text.strip() for text in texts):
        raise ValueError("Embedding batches cannot contain empty text.")
    if titles is not None and len(titles) != len(texts):
        raise ValueError("titles must have the same length as texts.")

    from google.genai import types

    model_name, dimension, _ = get_embedding_config()
    client = _get_gemini_client()
    max_batch = max(1, min(32, int(os.getenv("EMBEDDING_BATCH_SIZE", "16"))))
    attempts = max(1, min(5, int(os.getenv("GEMINI_MAX_RETRIES", "3"))))
    all_titles = list(titles) if titles is not None else [None] * len(texts)
    prepared = [
        prepare_embedding_input(text, is_query=is_query, title=title, model_name=model_name)
        for text, title in zip(texts, all_titles)
    ]
    output: List[List[float]] = []

    if model_name == "gemini-embedding-2":
        config = types.EmbedContentConfig(output_dimensionality=dimension)
        # Gemini Embedding 2 aggregates a list of content parts into one embedding.
        # Send each input separately to guarantee one vector per chunk/query.
        for value in prepared:
            last_error = None
            vector_result = None
            for attempt in range(attempts):
                try:
                    result = client.models.embed_content(
                        model=model_name,
                        contents=value,
                        config=config,
                    )
                    embeddings = getattr(result, "embeddings", None) or []
                    if len(embeddings) != 1:
                        raise RuntimeError(
                            f"Gemini Embedding 2 returned {len(embeddings)} vectors for a single input."
                        )
                    raw_values = getattr(embeddings[0], "values", None)
                    if not raw_values or len(raw_values) != dimension:
                        raise RuntimeError(
                            f"Gemini returned an empty or incompatible embedding; expected {dimension} dimensions."
                        )
                    vector = [float(item) for item in raw_values]
                    if any(not math.isfinite(item) for item in vector):
                        raise RuntimeError("Gemini returned non-finite embedding values.")
                    norm = math.sqrt(sum(item * item for item in vector))
                    if norm <= 0:
                        raise RuntimeError("Gemini returned a zero-length embedding.")
                    vector_result = [item / norm for item in vector]
                    break
                except Exception as exc:
                    last_error = exc
                    if attempt + 1 < attempts:
                        time.sleep(min(2 ** attempt, 4))
            if vector_result is None:
                logger.error("Gemini Embedding 2 request failed after %s attempts (%s).",
                             attempts, type(last_error).__name__)
                raise RuntimeError(
                    "Gemini Embedding 2 failed to embed one input. Check API key, model, quota and network."
                ) from last_error
            output.append(vector_result)
        return output

    # gemini-embedding-001 supports a list of strings and returns one vector per input.
    config = types.EmbedContentConfig(
        output_dimensionality=dimension,
        task_type="RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT",
    )
    for start in range(0, len(prepared), max_batch):
        batch = prepared[start:start + max_batch]
        last_error = None
        batch_vectors: Optional[List[List[float]]] = None
        for attempt in range(attempts):
            try:
                result = client.models.embed_content(
                    model=model_name,
                    contents=batch,
                    config=config,
                )
                raw_embeddings = getattr(result, "embeddings", None) or []
                if len(raw_embeddings) != len(batch):
                    raise RuntimeError(
                        f"Gemini returned {len(raw_embeddings)} vectors for {len(batch)} inputs."
                    )
                vectors: List[List[float]] = []
                for embedding in raw_embeddings:
                    raw_values = getattr(embedding, "values", None)
                    if not raw_values or len(raw_values) != dimension:
                        raise RuntimeError("Gemini returned an empty or incompatible embedding vector.")
                    vector = [float(item) for item in raw_values]
                    if any(not math.isfinite(item) for item in vector):
                        raise RuntimeError("Gemini returned non-finite embedding values.")
                    norm = math.sqrt(sum(item * item for item in vector))
                    if norm <= 0:
                        raise RuntimeError("Gemini returned a zero-length embedding.")
                    vectors.append([item / norm for item in vector])
                batch_vectors = vectors
                break
            except Exception as exc:
                last_error = exc
                if attempt + 1 < attempts:
                    time.sleep(min(2 ** attempt, 4))
        if batch_vectors is None:
            logger.error("Gemini Embedding 001 batch failed after %s attempts (%s).",
                         attempts, type(last_error).__name__)
            raise RuntimeError(
                f"Gemini Embedding 001 failed for a batch of {len(batch)} inputs. "
                "Check API key, model, quota and network."
            ) from last_error
        output.extend(batch_vectors)

    if len(output) != len(texts):
        raise RuntimeError("Gemini embedding provider returned a mismatched output count.")
    return output


def get_qdrant_client():
    global _CLIENT
    if _CLIENT is None:
        with _CLIENT_LOCK:
            if _CLIENT is None:
                from qdrant_client import QdrantClient
                url = os.getenv("QDRANT_URL", "http://localhost:6333").strip()
                api_key = os.getenv("QDRANT_API_KEY", "").strip() or None
                timeout = max(1.0, float(os.getenv("QDRANT_TIMEOUT_SECONDS", "10")))
                _CLIENT = QdrantClient(url=url, api_key=api_key, timeout=timeout)
    return _CLIENT


def _qdrant_models():
    from qdrant_client import models
    return models


def ensure_qdrant_collection() -> Dict[str, Any]:
    """Create a model-versioned named-dense/named-sparse collection and filter indexes."""
    model_name, dimension, collection = get_embedding_config()
    client = get_qdrant_client()
    models = _qdrant_models()
    existing = {entry.name for entry in client.get_collections().collections}
    if collection not in existing:
        client.create_collection(
            collection_name=collection,
            vectors_config={"dense": models.VectorParams(size=dimension, distance=models.Distance.COSINE)},
            sparse_vectors_config={"sparse": models.SparseVectorParams(modifier=models.Modifier.IDF)},
        )
        logger.info("Created Qdrant collection %s (model=%s, dimension=%s)", collection, model_name, dimension)
    info = client.get_collection(collection_name=collection)
    configured_vectors = info.config.params.vectors
    dense_config = configured_vectors.get("dense") if isinstance(configured_vectors, dict) else None
    sparse_config = info.config.params.sparse_vectors
    if (
        not isinstance(configured_vectors, dict)
        or dense_config is None
        or getattr(dense_config, "size", None) != dimension
        or sparse_config is None
        or "sparse" not in sparse_config
    ):
        raise RuntimeError(
            f"Qdrant collection {collection!r} has an incompatible named dense/sparse schema. "
            "Use a new versioned collection and re-index all source documents; never mix embedding spaces."
        )
    # Payload indexes make tenant/scope filters predictable as the collection grows.
    for field_name, field_schema in (
        ("user_id", models.PayloadSchemaType.INTEGER),
        ("college_id", models.PayloadSchemaType.INTEGER),
        ("document_id_key", models.PayloadSchemaType.INTEGER),
        ("is_college_doc", models.PayloadSchemaType.BOOL),
        ("index_status", models.PayloadSchemaType.KEYWORD),
        ("document_key", models.PayloadSchemaType.KEYWORD),
        ("filename", models.PayloadSchemaType.KEYWORD),
        ("heading", models.PayloadSchemaType.KEYWORD),
        ("embedding_model", models.PayloadSchemaType.KEYWORD),
        ("embedding_dimension", models.PayloadSchemaType.INTEGER),
    ):
        try:
            client.create_payload_index(
                collection_name=collection, field_name=field_name, field_schema=field_schema, wait=True
            )
        except Exception as exc:
            # Some servers report an already-existing index as a conflict; do not ignore other failures.
            message = str(exc).lower()
            if "already exists" not in message and "already indexed" not in message and "conflict" not in message:
                raise
    return {"collection": collection, "model": model_name, "dimension": dimension}


def qdrant_health() -> Dict[str, Any]:
    model, dimension, collection = get_embedding_config()
    client = get_qdrant_client()
    collections = {entry.name for entry in client.get_collections().collections}
    present = collection in collections
    if present:
        info = client.get_collection(collection_name=collection)
        configured = info.config.params.vectors
        dense = configured.get("dense") if isinstance(configured, dict) else configured
        present = dense is not None and getattr(dense, "size", None) == dimension
    return {"available": True, "collection_exists": present, "collection": collection,
            "embedding_model": model, "dimension": dimension}


def _get_sparse_model():
    global _SPARSE_MODEL
    if _SPARSE_MODEL is None:
        with _SPARSE_LOCK:
            if _SPARSE_MODEL is None:
                from fastembed import SparseTextEmbedding
                model_name = os.getenv("QDRANT_SPARSE_MODEL", "Qdrant/bm25")
                _SPARSE_MODEL = SparseTextEmbedding(model_name=model_name)
                logger.info("Loaded sparse retrieval model %s", model_name)
    return _SPARSE_MODEL


def _sparse_embedding(text: str, *, query: bool) -> Dict[str, List[Any]]:
    model = _get_sparse_model()
    method = getattr(model, "query_embed", None) if query else None
    method = method or model.embed
    item = next(iter(method([text])))
    return {"indices": [int(value) for value in item.indices],
            "values": [float(value) for value in item.values]}


def _scroll_ids(client, collection: str, document_key: str, user_id: int,
                *, status: Optional[str] = None) -> List[str]:
    models = _qdrant_models()
    must = [
        models.FieldCondition(key="document_key", match=models.MatchValue(value=document_key)),
        models.FieldCondition(key="user_id", match=models.MatchValue(value=int(user_id))),
    ]
    if status:
        must.append(models.FieldCondition(key="index_status", match=models.MatchValue(value=status)))
    found: List[str] = []
    offset = None
    while True:
        points, offset = client.scroll(
            collection_name=collection,
            scroll_filter=models.Filter(must=must),
            limit=256,
            offset=offset,
            with_payload=False,
            with_vectors=False,
        )
        found.extend(str(point.id) for point in points)
        if offset is None:
            break
    return found


def upsert_document_chunks(items: Sequence[Dict[str, Any]], dense_vectors: Sequence[Sequence[float]]) -> int:
    """Stage a full generation, activate only after every point has been uploaded, then retire old points."""
    if not items or len(items) != len(dense_vectors):
        raise ValueError("Document chunks and dense embeddings must be non-empty and have equal lengths.")
    model_name, dimension, collection = get_embedding_config()
    for vector in dense_vectors:
        if len(vector) != dimension or any(not math.isfinite(float(value)) for value in vector):
            raise ValueError("A dense vector has incompatible dimensions or non-finite values.")
    ensure_qdrant_collection()
    client = get_qdrant_client()
    models = _qdrant_models()
    user_id = int(items[0]["user_id"])
    document_key = str(items[0]["document_key"])
    generation_id = stable_generation_id(items, model_name)
    point_ids = [
        stable_point_id(collection, document_key, generation_id, int(item["chunk_index"]), str(item["content"]))
        for item in items
    ]
    current = _scroll_ids(client, collection, document_key, user_id, status="active")
    if set(current) == set(point_ids):
        return len(point_ids)

    sparse_vectors = [_sparse_embedding(str(item["content"]), query=False) for item in items]
    points = []
    for item, dense, sparse, point_id in zip(items, dense_vectors, sparse_vectors, point_ids):
        payload = {
            "content": str(item["content"]),
            "filename": str(item.get("filename") or "Document"),
            "heading": str(item.get("heading") or extract_heading(str(item["content"]))),
            "user_id": int(item["user_id"]),
            "document_id": item.get("document_id"),
            "document_id_key": int(item.get("document_id") or 0),
            "document_key": document_key,
            "is_college_doc": bool(item.get("is_college_doc", False)),
            "college_id": int(item["college_id"]) if item.get("college_id") is not None else None,
            "page_number": int(item.get("page_number") or 0),
            "chunk_index": int(item.get("chunk_index") or 0),
            "content_hash": hashlib.sha256(str(item["content"]).encode("utf-8")).hexdigest(),
            "embedding_model": model_name,
            "embedding_dimension": dimension,
            "chunking_version": "heading-paragraph-token-v3",
            "generation_id": generation_id,
            "index_status": "pending",
        }
        points.append(models.PointStruct(
            id=point_id,
            vector={
                "dense": [float(value) for value in dense],
                "sparse": models.SparseVector(indices=sparse["indices"], values=sparse["values"]),
            },
            payload=payload,
        ))
    # Pending points are invisible to queries. Existing active points remain available on failure.
    client.upload_points(collection_name=collection, points=points, batch_size=32, wait=True)
    client.set_payload(
        collection_name=collection,
        payload={"index_status": "active"},
        points=point_ids,
        wait=True,
    )
    current_ids = set(point_ids)
    stale = [point_id for point_id in current if point_id not in current_ids]
    if stale:
        client.delete(collection_name=collection, points_selector=stale, wait=True)

    # Retry after a partially failed ingestion can leave pending (never searchable) points.
    # Remove only pending points for this same document/owner after the new generation is active.
    pending = _scroll_ids(client, collection, document_key, user_id, status="pending")
    stale_pending = [point_id for point_id in pending if point_id not in current_ids]
    if stale_pending:
        client.delete(collection_name=collection, points_selector=stale_pending, wait=True)

    logger.info("Qdrant indexed document_key=%s generation=%s chunks=%s model=%s",
                document_key, generation_id, len(points), model_name)
    return len(points)


def _scope_filters(
    user_id: int,
    scope: str,
    college_id: Optional[int],
    model_name: str,
    dimension: int,
) -> List[Tuple[str, Any]]:
    models = _qdrant_models()
    base = [
        models.FieldCondition(key="index_status", match=models.MatchValue(value="active")),
        models.FieldCondition(key="embedding_model", match=models.MatchValue(value=model_name)),
        models.FieldCondition(key="embedding_dimension", match=models.MatchValue(value=dimension)),
    ]
    personal = models.Filter(must=base + [
        models.FieldCondition(key="user_id", match=models.MatchValue(value=int(user_id))),
    ], must_not=[
        models.FieldCondition(key="is_college_doc", match=models.MatchValue(value=True)),
    ])
    college = None
    if college_id is not None:
        college = models.Filter(must=base + [
            models.FieldCondition(key="is_college_doc", match=models.MatchValue(value=True)),
            models.FieldCondition(key="college_id", match=models.MatchValue(value=int(college_id))),
        ])
    if scope == "Personal Only":
        return [("personal", personal)]
    if scope == "College Only":
        return [("college", college)] if college is not None else []
    return [("personal", personal)] + ([("college", college)] if college is not None else [])


def retrieve_hybrid(question: str, dense_query: Sequence[float], user_id: Optional[int],
                    scope: str, college_id: Optional[int], top_k: int,
                    is_self: bool = False) -> List[Dict[str, Any]]:
    """Dense Gemini + sparse BM25 retrieval, strict tenant filters, then RRF across each rank list."""
    if not user_id:
        return []
    model_name, dimension, collection = get_embedding_config()
    if len(dense_query) != dimension:
        raise RuntimeError(
            f"Query vector dimension mismatch for {model_name}: expected {dimension}, got {len(dense_query)}."
        )
    client = get_qdrant_client()
    models = _qdrant_models()
    existing = {entry.name for entry in client.get_collections().collections}
    if collection not in existing:
        raise RuntimeError(
            f"Configured Qdrant collection {collection!r} is missing. "
            "Run ensure_qdrant_collection() and re-index source documents before querying."
        )
    candidate_k = max(top_k, min(100, int(os.getenv("RAG_CANDIDATE_K", "30"))))
    sparse_question = question
    exact_patterns = (
        (
            r"phone|mobile|contact|whatsapp|telephone|फोन|मोबाइल|संपर्क|व्हाट्सएप",
            "phone mobile contact telephone whatsapp number मोबाइल फोन नंबर संपर्क नंबर",
        ),
        (
            r"email|e-mail|mail address|ईमेल|मेल पता",
            "email e-mail mail address contact ईमेल मेल पता",
        ),
        (
            r"roll|enrollment|student\s*id|रोल नंबर|नामांकन संख्या",
            "roll number enrollment number student id रोल नंबर नामांकन संख्या",
        ),
        (r"cgpa|gpa|अंक", "CGPA GPA grade point average अंक"),
        (r"date of birth|\bdob\b|जन्म तिथि|janm\s*tithi", "date of birth DOB birth date जन्म तिथि"),
        (
            r"\b(my|mine|mera|meri|mere)\b.{0,25}\bnumber\b",
            "my mobile phone contact number phone number mobile number",
        ),
    )
    import re
    for pattern, aliases in exact_patterns:
        if re.search(pattern, question, re.IGNORECASE):
            sparse_question += " " + aliases
            break
    sparse_query = _sparse_embedding(sparse_question, query=True)
    fused: Dict[str, Dict[str, Any]] = {}
    try:
        for scope_name, query_filter in _scope_filters(
            int(user_id), scope, college_id, model_name, dimension
        ):
            for method, query_vector in (
                ("dense", [float(value) for value in dense_query]),
                ("keyword", models.SparseVector(
                    indices=sparse_query["indices"], values=sparse_query["values"]
                )),
            ):
                result = client.query_points(
                    collection_name=collection,
                    query=query_vector,
                    using="dense" if method == "dense" else "sparse",
                    query_filter=query_filter,
                    limit=candidate_k,
                    with_payload=True,
                    with_vectors=False,
                )
                for rank, point in enumerate(result.points, start=1):
                    point_id = str(point.id)
                    payload = point.payload or {}
                    content = str(payload.get("content") or "")
                    if not content.strip():
                        continue
                    candidate = fused.get(point_id)
                    if candidate is None:
                        candidate = {
                            "id": point_id,
                            "content": content,
                            "metadata": {
                                "filename": payload.get("filename") or "Document",
                                "heading": payload.get("heading") or "",
                                "user_id": payload.get("user_id"),
                                "document_id": payload.get("document_id"),
                                "embedding_model": payload.get("embedding_model"),
                                "generation_id": payload.get("generation_id"),
                                "content_hash": payload.get("content_hash"),
                            },
                            "filename": payload.get("filename") or "Document",
                            "document_id": payload.get("document_id"),
                            "page_number": payload.get("page_number") or 0,
                            "chunk_index": payload.get("chunk_index") or 0,
                            "similarity": 0.0,
                            "rrf_score": 0.0,
                            "retrieval_methods": [],
                            "is_personal": not bool(payload.get("is_college_doc", False)),
                            "embedding_model": payload.get("embedding_model"),
                            "generation_id": payload.get("generation_id"),
                        }
                        fused[point_id] = candidate
                    candidate["rrf_score"] += 1.0 / (60 + rank)
                    if method not in candidate["retrieval_methods"]:
                        candidate["retrieval_methods"].append(method)
                    if method == "dense":
                        candidate["similarity"] = float(point.score or 0.0)
                    else:
                        candidate["sparse_score"] = float(point.score or 0.0)
                    if scope_name == "personal" and is_self:
                        candidate["rrf_score"] += 0.002
        candidates = sorted(fused.values(), key=lambda item: item["rrf_score"], reverse=True)
        threshold = float(os.getenv("QDRANT_MIN_DENSE_SCORE", "0.35"))
        # A sparse-only hit is retained only for exact-fact intents or when the
        # query has meaningful lexical overlap. Common stopwords cannot make a chunk relevant.
        exact_fact_intent = bool(re.search(
            r"phone|mobile|contact|whatsapp|telephone|फोन|मोबाइल|संपर्क|व्हाट्सएप|email|e-mail|ईमेल|roll|enrollment|student\s*id|cgpa|gpa|date of birth|जन्म तिथि|\bdob\b|\b(my|mine|mera|meri|mere)\b.{0,25}\bnumber\b",
            question, re.IGNORECASE,
        ))
        stopwords = {
            "what", "which", "where", "when", "who", "how", "tell", "give", "show",
            "me", "my", "is", "are", "the", "a", "an", "of", "from", "in", "on",
            "please", "can", "you", "mera", "meri", "mere", "mujhe", "batao", "kya",
            "hai", "ka", "ki", "ke", "do", "i", "myself", "uploaded", "document",
            "documents", "file", "files",
        }
        query_terms = {
            token for token in re.findall(r"[\w@.+-]+", sparse_question.lower())
            if len(token) > 1 and token not in stopwords
        }
        def sparse_overlap(item):
            content_terms = set(re.findall(r"[\\w@.+-]+", str(item.get("content", "")).lower()))
            return len(query_terms & content_terms) / max(1, len(query_terms))
        candidates = [
            item for item in candidates
            if item["similarity"] >= threshold
            or (exact_fact_intent and "keyword" in item["retrieval_methods"])
            or ("keyword" in item["retrieval_methods"] and sparse_overlap(item) >= 0.25)
            or (is_self and item.get("is_personal") and item["similarity"] >= threshold)
        ]
        return candidates[:candidate_k]
    except Exception:
        logger.exception("Qdrant hybrid retrieval failed (model=%s, collection=%s)", model_name, collection)
        raise


def delete_document_chunks(document_id: int, user_id: int) -> int:
    """Delete only the verified owner's active/pending points for a document."""
    _, _, collection = get_embedding_config()
    client = get_qdrant_client()
    models = _qdrant_models()
    query_filter = models.Filter(must=[
        models.FieldCondition(key="document_id_key", match=models.MatchValue(value=int(document_id))),
        models.FieldCondition(key="user_id", match=models.MatchValue(value=int(user_id))),
    ])
    count = client.count(collection_name=collection, count_filter=query_filter, exact=True).count
    if count:
        client.delete(
            collection_name=collection,
            points_selector=models.FilterSelector(filter=query_filter),
            wait=True,
        )
    return int(count or 0)
