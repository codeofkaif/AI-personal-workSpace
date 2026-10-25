from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from evaluate_end_to_end import score_response


def test_e2e_scoring_checks_exact_fact_and_expected_source():
    row = {
        "id": "contact",
        "expected_contains": ["+91 98765-43210"],
        "expected_sources": ["profile.pdf"],
        "forbidden_terms": ["private-value-from-another-user"],
        "should_refuse": False,
    }
    payload = {
        "answer": "Mobile Number: +91 98765-43210 [Source: profile.pdf]",
        "sources": ["profile.pdf"],
        "clarification_needed": False,
    }
    result = score_response(row, payload, 0.5)
    assert result["passed"] is True
    assert result["expected_fact_matches"] == 1
    assert result["source_precision"] == 1.0
    assert result["source_recall"] == 1.0


def test_e2e_scoring_fails_when_source_is_missing():
    row = {
        "id": "contact",
        "expected_contains": ["98765-43210"],
        "expected_sources": ["profile.pdf"],
        "forbidden_terms": [],
        "should_refuse": False,
    }
    payload = {
        "answer": "98765-43210",
        "sources": [],
        "clarification_needed": False,
    }
    assert not score_response(row, payload, 0.25)["passed"]


def test_e2e_scoring_requires_empty_evidence_when_refusal_expected():
    row = {
        "id": "missing",
        "expected_contains": [],
        "expected_sources": [],
        "forbidden_terms": [],
        "should_refuse": True,
    }
    good = score_response(
        row,
        {"answer": "I could not verify that from the uploaded documents.", "sources": [], "clarification_needed": True},
        0.2,
    )
    bad = score_response(
        row,
        {"answer": "The answer is 123456.", "sources": ["other.pdf"], "clarification_needed": False},
        0.2,
    )
    assert good["passed"] is True
    assert good["refusal_correct"] is True
    assert bad["passed"] is False
