from pathlib import Path
import sys
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


def test_unknown_citation_falls_back_to_source_excerpt():
    context = [{"filename": "syllabus.pdf", "content": "The exam is in December."}]
    answer = "The exam is in May. [Source: made-up.pdf]"
    result = main._validate_source_citations(answer, context)
    assert "made-up.pdf" not in result
    assert "syllabus.pdf" in result
    assert "could not be verified" in result


def test_missing_citation_adds_actual_source_label():
    context = [{"filename": "syllabus.pdf", "content": "The exam is in December."}]
    result = main._validate_source_citations("The exam is in December.", context)
    assert "[Source: syllabus.pdf]" in result


def test_valid_citation_is_preserved():
    context = [{"filename": "syllabus.pdf", "content": "The exam is in December."}]
    answer = "The exam is in December. [Source: syllabus.pdf]"
    assert main._validate_source_citations(answer, context) == answer


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
