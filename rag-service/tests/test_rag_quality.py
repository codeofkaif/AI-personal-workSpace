from pathlib import Path
from io import BytesIO
import sys
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
from evaluate_retrieval import answer_faithfulness, mrr_at_k, ndcg_at_k, recall_at_k


def test_scope_filter_college_and_personal_are_parameterized():
    clause, params = main._scope_filter(7, "College + Personal")
    assert "d.user_id" in clause
    assert "d.college_id" in clause
    assert params == (7, 7, 7, 7)


def test_spaced_phone_number_is_preserved():
    context = [{
        "filename": "resume.pdf",
        "content": "Phone: +91 98765 43210\nEmail: ada@example.com",
    }]
    answer = main._extract_factual_answer("What is my phone number?", context, "Ada")
    assert answer is not None
    assert "+91 98765 43210" in answer
    assert "[Source: resume.pdf]" in answer


def test_ocr_page_text_is_normalized_and_indexable(monkeypatch):
    import types

    class Page:
        def extract_text(self):
            return ""

    class Reader:
        pages = [Page()]

    monkeypatch.setattr(
        main,
        "_ocr_pdf_page",
        lambda file_bytes, page_index: "Mobile 9 8 7 6 5 4 3 2 1 0",
    )
    monkeypatch.setitem(sys.modules, "pypdf", types.SimpleNamespace(PdfReader=lambda *args, **kwargs: Reader()))
    pages = main.extract_pages_from_file(b"%PDF-fake", "scan.pdf")
    assert pages
    _page, text = pages[0]
    assert "9 8 7 6 5 4 3 2 1 0" in text
    enriched = main.enrich_text_for_index(text)
    assert "9876543210" in main.compact_digit_runs(enriched)


def test_model_mismatch_filter_is_in_dense_sql():
    clause, _params = main._scope_filter(9, "Personal Only")
    # Retrieval SQL always compares embedding_model to the live configured model.
    source = Path(main.__file__).read_text(encoding="utf-8")
    assert "dc.embedding_model = %s" in source
    assert clause != "FALSE"


def test_zero_result_clear_query_does_not_ask_followup(monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setattr(main, "fetch_user_profile", lambda user_id, passed_profile=None: {
        "id": user_id, "name": "Test User", "role": "STUDENT", "college": "Test", "department": "CSE",
    })
    monkeypatch.setattr(main, "get_embedding", lambda text, is_query=False: [0.0] * main.EMBEDDING_DIMENSION)
    monkeypatch.setattr(main, "retrieve_context", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        main,
        "generate_answer",
        lambda question, context_items, user_profile, is_self: "I could not verify relevant information from the available documents.",
    )
    headers = {"X-RAG-API-Key": main.RAG_API_KEY} if main.RAG_API_KEY else {}
    with TestClient(main.app) as client:
        response = client.post(
            "/query",
            json={"question": "What is the semester 6 compiler design syllabus?", "user_id": 42, "scope": "Personal Only"},
            headers=headers,
        )
    payload = response.json()
    assert response.status_code == 200
    assert payload["clarification_needed"] is False
    assert "could not verify" in payload["answer"].lower() or "not found" in payload["answer"].lower() or "nahi mili" in payload["answer"].lower()


def test_followup_history_is_rewritten_into_standalone_query():
    history = [
        main.ConversationTurn(role="user", content="Tell me about the exam date"),
        main.ConversationTurn(role="assistant", content="The midterm is in December.", clarification_needed=False),
    ]
    result = main.understand_query("When is it?", history)
    assert result["action"] == "answer"
    assert "exam date" in result["normalized_query"].lower()
    assert "When is it?" in result["normalized_query"]


def test_hallucinated_citation_is_stripped():
    context = [{"filename": "notice.pdf", "content": "Holiday on 15 August."}]
    result = main._validate_source_citations("Holiday is in June. [Source: invented.pdf]", context)
    assert "invented.pdf" not in result
    assert "notice.pdf" in result


def test_answer_faithfulness_detects_invented_phone():
    score = answer_faithfulness(
        "Call 9999999999",
        ["Office phone: 9876543210"],
    )
    assert score == 0.0
    score_ok = answer_faithfulness(
        "Call 98765 43210",
        ["Office phone: 98765 43210"],
    )
    assert score_ok == 1.0


def test_retrieval_metrics_on_synthetic_ranking():
    retrieved = [11, 4, 7, 9]
    relevant = {7, 11}
    assert recall_at_k(retrieved, relevant, 5) == 1.0
    assert mrr_at_k(retrieved, relevant, 10) == 1.0
    assert ndcg_at_k(retrieved, relevant, 5) > 0.8


def test_heading_aware_chunk_keeps_section_title(monkeypatch):
    monkeypatch.setattr(main, "get_model", lambda: SimpleNamespace(tokenizer=None))
    text = "## Contact\n\nPhone: +91 98765 43210\n\n## Education\n\nB.Tech CSE"
    chunks = main.chunk_text(text, chunk_size=64, overlap=8)
    assert any("Contact" in chunk and "98765" in chunk for chunk in chunks)


def test_expand_query_adds_compact_digits():
    variants = main.expand_query("phone 98 765 43210")
    assert any("9876543210" in item.replace(" ", "") or "9876543210" in main.compact_digit_runs(item) for item in variants)
