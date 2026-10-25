from pathlib import Path
from io import BytesIO
import sys
import pytest
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


class WhitespaceTokenizer:
    def encode(self, text, add_special_tokens=False):
        return text.split()

    def decode(self, tokens, skip_special_tokens=True):
        return " ".join(tokens)


def test_chunker_handles_empty_text(monkeypatch):
    monkeypatch.setattr(main, "get_model", lambda: SimpleNamespace(tokenizer=WhitespaceTokenizer()))
    assert main.chunk_text(" \n\n ") == []


def test_chunker_keeps_paragraphs_and_splits_oversized_text(monkeypatch):
    monkeypatch.setattr(main, "get_model", lambda: SimpleNamespace(tokenizer=WhitespaceTokenizer()))
    text = " ".join(f"w{i}" for i in range(160))
    chunks = main.chunk_text(text, chunk_size=64, overlap=8)
    assert len(chunks) >= 3
    assert all(chunk.strip() for chunk in chunks)
    # Sliding windows preserve some boundary context for long paragraphs.
    assert set(chunks[0].split()[-8:]) & set(chunks[1].split()[:8])


def test_self_reference_uses_word_boundaries():
    profile = {"name": "Md Kaif Ali"}
    assert main.is_self_referential_query("Mera CGPA kya hai?", profile)
    assert main.is_self_referential_query("What is Md Kaif Ali's role?", profile)
    assert not main.is_self_referential_query("Explain semester 6 syllabus", profile)
    assert not main.is_self_referential_query("Tell me about Spring Boot", profile)
    assert not main.is_self_referential_query("Explain the main method in Java", profile)
    assert main.is_self_referential_query("Main kaun hu?", profile)


def test_scope_filter_denies_unauthenticated_user():
    clause, params = main._scope_filter(None, "College + Personal")
    assert clause == "FALSE"
    assert params == ()


def test_personal_scope_is_parameterized():
    clause, params = main._scope_filter(42, "Personal Only")
    assert "d.user_id" in clause
    assert params == (42, 42)


def test_college_scope_checks_current_users_college():
    clause, params = main._scope_filter(42, "College Only")
    assert "d.college_id" in clause
    assert "u.college_id" in clause
    assert params == (42, 42)


def test_unknown_citation_is_stripped_and_real_source_is_attached():
    # Citation validation strips fabricated source labels, then lists only retrieved sources.
    context = [{"filename": "syllabus.pdf", "content": "The exam is in December."}]
    answer = "The exam is in May. [Source: made-up.pdf]"
    result = main._validate_source_citations(answer, context)
    assert "made-up.pdf" not in result
    assert "syllabus.pdf" in result
    assert "**Sources:**" in result


def test_missing_citation_adds_actual_source_label():
    context = [{"filename": "syllabus.pdf", "content": "The exam is in December."}]
    result = main._validate_source_citations("The exam is in December.", context)
    assert "[Source: syllabus.pdf]" in result


def test_valid_citation_is_preserved():
    context = [{"filename": "syllabus.pdf", "content": "The exam is in December."}]
    answer = "The exam is in December. [Source: syllabus.pdf]"
    assert main._validate_source_citations(answer, context) == answer


def test_factual_extractor_accepts_spaced_and_hyphenated_phone_number():
    context = [{
        "filename": "profile.pdf",
        "content": "Contact details: Mobile Number: +91 98765-43210",
    }]
    answer = main._extract_factual_answer(
        "give me my mobile phone number", context, "Test"
    )
    assert answer is not None
    assert "+91 98765-43210" in answer
    assert "[Source: profile.pdf]" in answer


def test_chunker_keeps_section_headings_with_related_content(monkeypatch):
    import vector_store

    monkeypatch.setattr(main, "RAG_VECTOR_BACKEND", "qdrant")
    monkeypatch.setattr(vector_store, "get_text_tokenizer", lambda: None)
    chunks = main.chunk_text(
        "## Contact Details\nMobile: +91 98765-43210\n\n## Education\nCGPA: 8.4",
        chunk_size=64,
        overlap=8,
    )
    assert any("## Contact Details" in chunk and "Mobile: +91 98765-43210" in chunk for chunk in chunks)
    assert any("## Education" in chunk and "CGPA: 8.4" in chunk for chunk in chunks)


def test_long_table_chunks_repeat_the_table_header(monkeypatch):
    import vector_store

    monkeypatch.setattr(main, "RAG_VECTOR_BACKEND", "qdrant")
    monkeypatch.setattr(vector_store, "get_text_tokenizer", lambda: None)
    rows = [
        f"Person {i} | Mobile contact details for student number {i} and college directory record"
        for i in range(1, 40)
    ]
    table = "TABLE\nName | Contact\n" + "\n".join(rows)
    chunks = main.chunk_text(table, chunk_size=64, overlap=8)
    assert len(chunks) > 1
    assert all(chunk.startswith("TABLE\nName | Contact") for chunk in chunks)


class FakeVectorBatch(list):
    def tolist(self):
        return list(self)


class FakeE5Model:
    def __init__(self):
        self.inputs = None
        self.tokenizer = WhitespaceTokenizer()

    def encode(self, texts, **kwargs):
        self.inputs = texts
        return FakeVectorBatch([[1.0] + [0.0] * (main.EMBEDDING_DIMENSION - 1) for _ in texts])


def test_e5_uses_query_and_passage_prefixes(monkeypatch):
    fake = FakeE5Model()
    monkeypatch.setattr(main, "get_model", lambda: fake)
    passages = main.get_embeddings(["document text"])
    queries = main.get_embeddings(["question text"], is_query=True)
    assert fake.inputs == ["query: question text"]
    assert len(passages[0]) == main.EMBEDDING_DIMENSION
    assert len(queries[0]) == main.EMBEDDING_DIMENSION


def test_embedding_failure_is_not_converted_to_zero_vector(monkeypatch):
    def fail_model():
        raise RuntimeError("model weights missing")
    monkeypatch.setattr(main, "get_model", fail_model)
    try:
        main.get_embedding("a question", is_query=True)
    except RuntimeError as exc:
        assert "model weights missing" in str(exc)
    else:
        raise AssertionError("Embedding failure must propagate; zero vectors are unsafe.")

def test_context_selector_deduplicates_and_respects_chunk_count(monkeypatch):
    monkeypatch.setattr(main, "get_model", lambda: SimpleNamespace(tokenizer=WhitespaceTokenizer()))
    monkeypatch.setattr(main, "RAG_CONTEXT_CHUNKS", 2)
    monkeypatch.setattr(main, "RAG_CONTEXT_TOKEN_BUDGET", 100)
    candidates = [
        {"id": 1, "content": "same evidence", "filename": "a.pdf"},
        {"id": 2, "content": "same evidence", "filename": "a.pdf"},
        {"id": 3, "content": "different evidence", "filename": "b.pdf"},
    ]
    selected = main.select_context_items(candidates)
    assert [item["id"] for item in selected] == [1, 3]


def test_context_selector_obeys_token_budget(monkeypatch):
    monkeypatch.setattr(main, "get_model", lambda: SimpleNamespace(tokenizer=WhitespaceTokenizer()))
    monkeypatch.setattr(main, "RAG_CONTEXT_CHUNKS", 8)
    monkeypatch.setattr(main, "RAG_CONTEXT_TOKEN_BUDGET", 64)
    candidates = [
        {"id": 1, "content": " ".join(f"a{i}" for i in range(40)), "filename": "a.pdf"},
        {"id": 2, "content": " ".join(f"b{i}" for i in range(40)), "filename": "b.pdf"},
    ]
    selected = main.select_context_items(candidates)
    assert sum(len(item["content"].split()) for item in selected) <= 64



def test_ollama_health_requires_exact_configured_model_tag():
    assert main._ollama_model_available(
        [{"name": "qwen3.5:9b-q4_K_M", "model": "qwen3.5:9b-q4_K_M"}],
        "qwen3.5:9b-q4_K_M",
    )
    assert not main._ollama_model_available(
        [{"name": "qwen3:4b-instruct-2507-q4_K_M"}],
        "qwen3.5:9b-q4_K_M",
    )
    assert not main._ollama_model_available([], "qwen3.5:9b-q4_K_M")


def test_scan_pdf_without_extractable_text_is_rejected_with_ocr_hint(monkeypatch):
    from fastapi import HTTPException

    monkeypatch.setattr(main, "extract_pages_from_file", lambda file_bytes, filename: [])
    monkeypatch.setattr(main.shutil, "which", lambda command: None)
    upload = main.UploadFile(filename="scanned-notes.pdf", file=BytesIO(b"fake pdf bytes"))

    with pytest.raises(HTTPException) as raised:
        main.ingest_document(file=upload, user_id=42, document_id=None)

    assert raised.value.status_code == 422
    assert "not indexed" in raised.value.detail
    assert "Tesseract" in raised.value.detail


class FakeRagCursor:
    """Small deterministic PostgreSQL/pgvector fake for the upload-to-query contract."""

    def __init__(self, database):
        self.database = database
        self.rows = []
        self.one = None

    def execute(self, query, params=None):
        normalized = " ".join(query.split())
        params = params or ()
        self.rows = []
        self.one = None

        if normalized.startswith("INSERT INTO document_chunks"):
            import json

            content, metadata, page_number, chunk_index, document_id, embedding, embedding_model = params
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            self.database.rows.append({
                "id": self.database.next_id,
                "content": content,
                "metadata": metadata,
                "page_number": page_number,
                "chunk_index": chunk_index,
                "document_id": document_id,
                "embedding": embedding,
                "embedding_model": embedding_model,
            })
            self.database.next_id += 1
        elif normalized.startswith("DELETE FROM document_chunks"):
            if "metadata->>'user_id'" in normalized:
                owner, filename = params
                self.database.rows = [
                    row for row in self.database.rows
                    if not (
                        row["document_id"] is None
                        and str(row["metadata"].get("user_id")) == str(owner)
                        and row["metadata"].get("filename") == filename
                    )
                ]
            elif params:
                document_id = params[0]
                self.database.rows = [
                    row for row in self.database.rows if row["document_id"] != document_id
                ]
        elif normalized.startswith("SELECT dc.id") and "ORDER BY dc.embedding <=> " in normalized:
            # This represents the dense vector query over rows committed during ingestion.
            requested_user = params[1]
            model_name = params[-3]
            for row in self.database.rows:
                if row["embedding_model"] != model_name:
                    continue
                if str(row["metadata"].get("user_id")) != str(requested_user):
                    continue
                self.rows.append((
                    row["id"], row["content"], row["metadata"], 0.93,
                    row["document_id"], row["chunk_index"], row["page_number"]
                ))
        elif normalized.startswith("SELECT 1"):
            self.one = (1,)

    def fetchall(self):
        return list(self.rows)

    def fetchone(self):
        return self.one

    def close(self):
        pass


class FakeRagDatabase:
    def __init__(self):
        self.rows = []
        self.next_id = 1
        self.commits = 0

    def cursor(self):
        return FakeRagCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        pass

    def close(self):
        pass


def test_upload_then_immediate_query_retrieves_the_new_database_chunk(monkeypatch):
    """Regression: a successful upload must commit searchable chunks before returning."""
    from fastapi.testclient import TestClient

    marker = "ORBITAL-ATLAS-7391"
    db = FakeRagDatabase()
    seen_context = {}

    monkeypatch.setattr(main, "get_db_connection", lambda: db)
    monkeypatch.setattr(
        main,
        "extract_pages_from_file",
        lambda file_bytes, filename: [(1, f"Private test marker: {marker}.")],
    )
    monkeypatch.setattr(main, "chunk_text", lambda text: [text])
    monkeypatch.setattr(
        main,
        "get_embeddings",
        lambda texts, is_query=False: [[0.0] * main.EMBEDDING_DIMENSION for _ in texts],
    )
    monkeypatch.setattr(
        main,
        "get_embedding",
        lambda text, is_query=False: [0.0] * main.EMBEDDING_DIMENSION,
    )
    monkeypatch.setattr(
        main,
        "get_model",
        lambda: SimpleNamespace(tokenizer=WhitespaceTokenizer()),
    )
    monkeypatch.setattr(main, "RERANK_ENABLED", False)
    monkeypatch.setattr(
        main,
        "fetch_user_profile",
        lambda user_id, passed_profile=None: {
            "id": user_id,
            "name": "Test User",
            "role": "STUDENT",
            "college": "Test College",
            "department": "CSE",
        },
    )

    def fake_generate(question, context_items, user_profile, is_self):
        seen_context["items"] = list(context_items)
        return f"The indexed marker is {marker}. [Source: fresh.txt]"

    monkeypatch.setattr(main, "generate_answer", fake_generate)
    # Avoid external Ollama calls inside this deterministic ingestion/retrieval test.
    monkeypatch.setattr(
        main, "_classify_query_clarity",
        lambda question, history: {
            "action": "answer",
            "normalized_query": question,
            "clarification_question": None,
        },
    )
    headers = {"X-RAG-API-Key": main.RAG_API_KEY} if main.RAG_API_KEY else {}

    with TestClient(main.app) as client:
        uploaded = client.post(
            "/ingest",
            files={
                "file": (
                    "fresh.txt",
                    b"Private test marker: ORBITAL-ATLAS-7391.",
                    "text/plain",
                )
            },
            data={"user_id": "42"},
            headers=headers,
        )
        assert uploaded.status_code == 200, uploaded.text
        upload_json = uploaded.json()
        assert upload_json["success"] is True
        assert upload_json["chunks_created"] == 1
        assert db.commits >= 2
        assert len(db.rows) == 1
        assert db.rows[0]["content"] == f"Private test marker: {marker}."

        # Intentionally no sleep/delay between the successful upload and this query.
        result = client.post(
            "/query",
            json={
                "question": "What is the private test marker?",
                "user_id": 42,
                "scope": "Personal Only",
                "top_k": 5,
            },
            headers=headers,
        )
        assert result.status_code == 200, result.text
        query_json = result.json()
        assert query_json["chunks_used"] == 1
        assert marker in query_json["answer"]
        assert query_json["sources"] == ["fresh.txt"]
        assert seen_context["items"][0]["content"] == f"Private test marker: {marker}."



def test_conversation_history_is_bounded_to_most_recent_eight_turns():
    history = [
        main.ConversationTurn(role="user", content=f"Question {index}")
        for index in range(10)
    ]
    normalized = main._history_as_dicts(history)
    assert len(normalized) == 8
    assert normalized[0]["content"] == "Question 2"
    assert normalized[-1]["content"] == "Question 9"


def test_unclear_query_asks_followup_only_after_retrieval_recovery(monkeypatch):
    from fastapi.testclient import TestClient

    calls = {"retrieval": 0}

    monkeypatch.setattr(main, "RAG_QUERY_CLARIFICATION_ENABLED", False)
    monkeypatch.setattr(
        main,
        "fetch_user_profile",
        lambda user_id, passed_profile=None: {
            "id": user_id, "name": "Test User", "role": "STUDENT",
            "department": "CSE", "college": "Test College", "college_id": 7,
        },
    )

    def exhausted_retrieval(*args, **kwargs):
        calls["retrieval"] += 1
        return []

    def forbidden_generation(*args, **kwargs):
        raise AssertionError("No answer may be generated without retrieved evidence")

    monkeypatch.setattr(main, "retrieve_with_recovery", exhausted_retrieval)
    monkeypatch.setattr(main, "generate_answer", forbidden_generation)
    headers = {"X-RAG-API-Key": main.RAG_API_KEY} if main.RAG_API_KEY else {}

    with TestClient(main.app) as client:
        response = client.post(
            "/query",
            json={"question": "Explain this", "user_id": 42, "scope": "Personal Only"},
            headers=headers,
        )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert calls["retrieval"] == 1
    assert payload["clarification_needed"] is True
    assert payload["sources"] == []
    assert payload["chunks_used"] == 0
    assert "uploaded document" in payload["answer"]


def test_pending_clarification_combines_original_request_and_reply(monkeypatch):
    monkeypatch.setattr(main, "_classify_query_clarity", lambda question, history: None)
    history = [
        main.ConversationTurn(role="user", content="Explain Spring"),
        main.ConversationTurn(
            role="assistant",
            content="Do you mean the Spring Framework or the spring season?",
            clarification_needed=True,
        ),
    ]
    result = main.understand_query("Spring Framework in Java", history)
    assert result["action"] == "answer"
    assert "Original request: Explain Spring" in result["normalized_query"]
    assert "User clarification: Spring Framework in Java" in result["normalized_query"]


def test_yes_alone_does_not_resolve_a_two_option_clarification():
    history = [
        main.ConversationTurn(role="user", content="Explain Spring"),
        main.ConversationTurn(
            role="assistant",
            content="Do you mean the Spring Framework or the spring season?",
            clarification_needed=True,
        ),
    ]
    result = main.understand_query("yes", history)
    assert result["action"] == "clarify"
    assert "specific option" in result["clarification_question"]


def test_classifier_can_normalize_a_typo_before_retrieval(monkeypatch):
    seen = {}
    def fake_classifier(question, history):
        seen["question"] = question
        return {
            "action": "answer",
            "normalized_query": "Explain dependency injection in Spring Boot",
            "clarification_question": None,
        }
    monkeypatch.setattr(main, "_classify_query_clarity", fake_classifier)
    result = main.understand_query("Explane dependancy injection in Spring Boot", [])
    assert seen["question"] == "Explane dependancy injection in Spring Boot"
    assert result["action"] == "answer"
    assert result["normalized_query"] == "Explain dependency injection in Spring Boot"


def test_ambiguous_short_query_still_reaches_retrieval(monkeypatch):
    monkeypatch.setattr(
        main, "_classify_query_clarity",
        lambda question, history: {
            "action": "clarify",
            "normalized_query": None,
            "clarification_question": "Do you mean the Spring Framework in Java or the spring season?",
        },
    )
    result = main.understand_query("Explain Spring", [])
    assert result["action"] == "answer"
    assert result["normalized_query"] == "Explain Spring"


def test_clear_short_query_proceeds_when_classifier_confirms_intent(monkeypatch):
    monkeypatch.setattr(
        main, "_classify_query_clarity",
        lambda question, history: {
            "action": "answer",
            "normalized_query": "What is Java virtual machine?",
            "clarification_question": None,
        },
    )
    result = main.understand_query("What is JVM?", [])
    assert result["action"] == "answer"
    assert result["normalized_query"] == "What is Java virtual machine?"


def test_classifier_failure_falls_back_for_non_obvious_short_query(monkeypatch):
    monkeypatch.setattr(main, "_classify_query_clarity", lambda question, history: None)
    result = main.understand_query("Explain Java collections", [])
    assert result["action"] == "answer"
    assert result["normalized_query"] == "Explain Java collections"
