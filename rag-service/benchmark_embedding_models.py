#!/usr/bin/env python3
"""Compare Gemini embedding models on manually-labelled retrieval examples.

This evaluates dense retrieval directly, on the same small candidate corpus per question,
so it isolates embedding space quality from Qdrant, sparse retrieval and reranking. Use
real, consented, redacted examples before selecting the production model.

JSONL schema per line:
{"id":"case-1","language":"en","question":"...","documents":[{"id":"chunk-1","title":"profile.pdf","text":"..."}],"relevant_ids":["chunk-1"]}

Run from repository root after setting GEMINI_API_KEY in .env:
  python rag-service/benchmark_embedding_models.py rag-service/evaluation/embedding_benchmark_sample.jsonl
"""
from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Set

SERVICE_DIR = Path(__file__).resolve().parent
ROOT_DIR = SERVICE_DIR.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
except ImportError:
    pass
sys.path.insert(0, str(SERVICE_DIR))

import vector_store  # noqa: E402

DEFAULT_MODELS = ("gemini-embedding-2", "gemini-embedding-001")
DEFAULT_DIMENSION = 768


def percentile(values: Sequence[float], fraction: float):
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(fraction * len(ordered)) - 1))
    return round(ordered[index], 4)


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    if len(a) != len(b):
        raise ValueError("Cannot compare embeddings with incompatible dimensions.")
    norm_a = math.sqrt(sum(value * value for value in a))
    norm_b = math.sqrt(sum(value * value for value in b))
    if not norm_a or not norm_b:
        return 0.0
    return sum(x * y for x, y in zip(a, b)) / (norm_a * norm_b)


def load_dataset(path: Path) -> List[Dict[str, Any]]:
    rows = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON on line {line_no}: {exc}") from exc
        if not isinstance(row.get("question"), str) or not row["question"].strip():
            raise ValueError(f"Line {line_no} needs a non-empty question.")
        documents = row.get("documents")
        if not isinstance(documents, list) or not documents:
            raise ValueError(f"Line {line_no} needs a non-empty documents list.")
        doc_ids = set()
        for doc in documents:
            if not isinstance(doc, dict) or not all(
                isinstance(doc.get(key), str) and doc[key].strip()
                for key in ("id", "text")
            ):
                raise ValueError(f"Line {line_no} documents need non-empty id and text.")
            if doc["id"] in doc_ids:
                raise ValueError(f"Line {line_no} contains duplicate document id {doc['id']!r}.")
            doc_ids.add(doc["id"])
        relevant = row.get("relevant_ids")
        if not isinstance(relevant, list) or not relevant:
            raise ValueError(f"Line {line_no} needs manually verified relevant_ids.")
        if not set(str(value) for value in relevant).issubset(doc_ids):
            raise ValueError(f"Line {line_no} relevant_ids must refer to document IDs on that line.")
        row["relevant_ids"] = set(str(value) for value in relevant)
        row["id"] = str(row.get("id") or f"case-{line_no}")
        rows.append(row)
    if not rows:
        raise ValueError("Evaluation dataset is empty.")
    return rows


def ranking_metrics(ranked_ids: Sequence[str], relevant: Set[str]) -> Dict[str, float]:
    def recall(k: int) -> float:
        return len(set(ranked_ids[:k]) & relevant) / max(1, len(relevant))
    positions = [idx for idx, value in enumerate(ranked_ids[:10], start=1) if value in relevant]
    reciprocal_rank = 1.0 / positions[0] if positions else 0.0
    gains = [
        1.0 / math.log2(rank + 1)
        for rank, value in enumerate(ranked_ids[:10], start=1)
        if value in relevant
    ]
    ideal = sum(
        1.0 / math.log2(rank + 1)
        for rank in range(1, min(len(relevant), 10) + 1)
    )
    return {
        "recall_at_5": recall(5),
        "recall_at_10": recall(10),
        "mrr_at_10": reciprocal_rank,
        "ndcg_at_10": sum(gains) / ideal if ideal else 0.0,
    }


def _set_model(model: str, dimension: int) -> None:
    os.environ["EMBEDDING_MODEL_NAME"] = model
    os.environ["EMBEDDING_DIMENSION"] = str(dimension)
    model_slug = model.lower().replace("-", "_").replace(".", "_")
    os.environ["QDRANT_COLLECTION_NAME"] = (
        f"benchmark_{model_slug}_{dimension}_v1"
    )


def run_model(rows: List[Dict[str, Any]], model: str, dimension: int) -> Dict[str, Any]:
    _set_model(model, dimension)
    query_latencies: List[float] = []
    doc_latencies: List[float] = []
    metrics = {key: [] for key in ("recall_at_5", "recall_at_10", "mrr_at_10", "ndcg_at_10")}
    details = []
    calls_expected = 0
    chars_embedded = 0

    # Do not log evaluation document text or embed it in the report.
    for index, row in enumerate(rows, start=1):
        docs = row["documents"]
        titles = [str(doc.get("title") or "none") for doc in docs]
        doc_texts = [doc["text"] for doc in docs]
        chars_embedded += sum(len(value) for value in doc_texts) + len(row["question"])
        batch_size = max(1, min(32, int(os.getenv("EMBEDDING_BATCH_SIZE", "16"))))
        if model == "gemini-embedding-2":
            calls_expected += len(doc_texts) + 1
        else:
            calls_expected += math.ceil(len(doc_texts) / batch_size) + 1

        started = time.perf_counter()
        doc_vectors = vector_store.gemini_embed_texts(
            doc_texts, is_query=False, titles=titles
        )
        doc_elapsed = time.perf_counter() - started
        doc_latencies.append(doc_elapsed)

        started = time.perf_counter()
        query_vector = vector_store.gemini_embed_texts(
            [row["question"]], is_query=True
        )[0]
        query_elapsed = time.perf_counter() - started
        query_latencies.append(query_elapsed)

        scores = [
            (doc["id"], cosine(query_vector, vector))
            for doc, vector in zip(docs, doc_vectors)
        ]
        scores.sort(key=lambda pair: pair[1], reverse=True)
        ranked = [doc_id for doc_id, _ in scores]
        case_metrics = ranking_metrics(ranked, row["relevant_ids"])
        for key, value in case_metrics.items():
            metrics[key].append(value)
        details.append({
            "id": row["id"],
            "language": row.get("language", "unspecified"),
            "retrieved_ids": ranked[:10],
            "relevant_ids": sorted(row["relevant_ids"]),
            **{key: round(value, 4) for key, value in case_metrics.items()},
            "query_embedding_seconds": round(query_elapsed, 4),
            "document_embeddings_seconds": round(doc_elapsed, 4),
        })
        print(f"[{model}] {index}/{len(rows)} | query {query_elapsed:.2f}s | {row['id']}")

    return {
        "model": model,
        "dimension": dimension,
        "cases": len(rows),
        "metrics": {
            key: round(statistics.mean(values), 4) if values else None
            for key, values in metrics.items()
        },
        "latency_seconds": {
            "query_embedding_p50": percentile(query_latencies, 0.50),
            "query_embedding_p95": percentile(query_latencies, 0.95),
            "document_embedding_p50": percentile(doc_latencies, 0.50),
            "document_embedding_p95": percentile(doc_latencies, 0.95),
            "query_embedding_mean": round(statistics.mean(query_latencies), 4),
            "document_embedding_mean": round(statistics.mean(doc_latencies), 4),
        },
        "estimated_api_requests": calls_expected,
        "embedded_characters": chars_embedded,
        "per_case": details,
        "limitations": [
            "Dense-only ranking; Qdrant sparse retrieval, fusion, filters and reranking are not measured here.",
            "Synthetic examples validate the harness, not production relevance. Select a model using a manually labelled, representative and consented dataset.",
            "Google billing price is not inferred from character count; check the provider usage/billing dashboard for actual token usage and cost.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--models", nargs="+", default=list(DEFAULT_MODELS), choices=DEFAULT_MODELS)
    parser.add_argument("--dimension", type=int, default=DEFAULT_DIMENSION)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not os.getenv("GEMINI_API_KEY", "").strip():
        print("GEMINI_API_KEY is required. Set it in your ignored local .env; do not pass it on the command line.", file=sys.stderr)
        return 2
    if not args.dataset.is_file():
        print(f"Dataset not found: {args.dataset}", file=sys.stderr)
        return 2
    if not 128 <= args.dimension <= 3072:
        print("--dimension must be between 128 and 3072.", file=sys.stderr)
        return 2

    rows = load_dataset(args.dataset)
    results = []
    for model in args.models:
        results.append(run_model(rows, model, args.dimension))

    report = {
        "dataset": args.dataset.name,
        "cases": len(rows),
        "embedding_models": results,
        "comparison_note": (
            "Compare models on the same labelled queries/documents. Prefer the best measured "
            "retrieval metrics that meet latency and budget constraints; do not select from synthetic examples alone."
        ),
    }
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    print("\n" + rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
