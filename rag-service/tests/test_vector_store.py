from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

import vector_store


def test_gemini_embedding_two_uses_query_instruction():
    actual = vector_store.prepare_embedding_input(
        "what is my phone number?",
        is_query=True,
        model_name="gemini-embedding-2",
    )
    assert actual == "task: question answering | query: what is my phone number?"


def test_gemini_embedding_two_uses_title_for_documents():
    actual = vector_store.prepare_embedding_input(
        "My mobile is 98765 43210",
        is_query=False,
        title="Profile.pdf",
        model_name="gemini-embedding-2",
    )
    assert actual == "title: Profile.pdf | text: My mobile is 98765 43210"


def test_embedding_input_rejects_empty_text():
    with pytest.raises(ValueError):
        vector_store.prepare_embedding_input(
            "  ", is_query=True, model_name="gemini-embedding-2"
        )


def test_point_id_is_deterministic_and_content_sensitive():
    first = vector_store.stable_point_id("collection", "doc:5", "generation", 0, "mobile A")
    repeat = vector_store.stable_point_id("collection", "doc:5", "generation", 0, "mobile A")
    changed = vector_store.stable_point_id("collection", "doc:5", "generation", 0, "mobile B")
    assert first == repeat
    assert first != changed


def test_generation_hash_changes_when_chunk_metadata_changes():
    base = [{
        "document_key": "document:5",
        "filename": "profile.pdf",
        "document_id": 5,
        "user_id": 12,
        "college_id": 3,
        "is_college_doc": False,
        "page_number": 1,
        "chunk_index": 0,
        "content": "contact 98765 43210",
    }]
    first = vector_store.stable_generation_id(base, "gemini-embedding-2")
    changed = [dict(base[0], content="contact 98765 43211")]
    assert first != vector_store.stable_generation_id(changed, "gemini-embedding-2")


def test_embedding_collection_is_versioned_by_model_and_dimension(monkeypatch):
    monkeypatch.delenv("QDRANT_COLLECTION_NAME", raising=False)
    monkeypatch.setenv("EMBEDDING_MODEL_NAME", "gemini-embedding-2")
    monkeypatch.setenv("EMBEDDING_DIMENSION", "768")
    _, _, collection_a = vector_store.get_embedding_config()
    monkeypatch.setenv("EMBEDDING_MODEL_NAME", "gemini-embedding-001")
    _, _, collection_b = vector_store.get_embedding_config()
    assert "gemini_embedding_2_768" in collection_a
    assert "gemini_embedding_001_768" in collection_b
    assert collection_a != collection_b


def test_embedding_dimension_is_validated(monkeypatch):
    monkeypatch.setenv("EMBEDDING_DIMENSION", "32")
    with pytest.raises(RuntimeError):
        vector_store.get_embedding_config()
