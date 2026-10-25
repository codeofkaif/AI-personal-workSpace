#!/usr/bin/env python3
"""Measure end-to-end RAG behavior against manually-labelled requests.

This calls the running FastAPI service and measures actual response latency, source metadata,
expected-fact matches, empty-evidence behavior and forbidden-term leakage. Use real user IDs
only in a private local dataset; the report does not store question text or answer content.

JSONL fields:
{"id":"contact-1","question":"What is my phone number?","user_id":12,"scope":"Personal Only","expected_contains":["+91 98765-43210"],"expected_sources":["profile.pdf"]}
For missing-evidence tests, set "should_refuse": true. For scope-isolation tests, set
"forbidden_terms": ["secret value from another user's fixture"].

Run with the FastAPI service and its dependencies already started:
  python rag-service/evaluate_end_to_end.py rag-service/evaluation/private-e2e.jsonl
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Sequence

SERVICE_DIR = Path(__file__).resolve().parent
ROOT_DIR = SERVICE_DIR.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
except ImportError:
    pass


def percentile(values: Sequence[float], fraction: float):
    if not values:
        return None
    ordered = sorted(values)
    import math
    index = min(len(ordered) - 1, max(0, math.ceil(fraction * len(ordered)) - 1))
    return round(ordered[index], 4)


def load_dataset(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON on line {line_no}: {exc}") from exc
        if not isinstance(row.get("question"), str) or not row["question"].strip():
            raise ValueError(f"Line {line_no} needs a non-empty question.")
        if not isinstance(row.get("user_id"), int) or row["user_id"] <= 0:
            raise ValueError(f"Line {line_no} needs a real private evaluation user_id.")
        scope = row.get("scope", "College + Personal")
        if scope not in {"Personal Only", "College Only", "College + Personal"}:
            raise ValueError(f"Line {line_no} has an invalid scope.")
        for key in ("expected_contains", "expected_sources", "forbidden_terms"):
            value = row.get(key, [])
            if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
                raise ValueError(f"Line {line_no} field {key!r} must be a list of strings.")
        if row.get("should_refuse", False) and row.get("expected_contains"):
            raise ValueError(f"Line {line_no} cannot combine should_refuse with expected_contains.")
        row["id"] = str(row.get("id") or f"case-{line_no}")
        row["scope"] = scope
        rows.append(row)
    if not rows:
        raise ValueError("Evaluation dataset is empty.")
    return rows


def _normalized(value: str) -> str:
    return " ".join((value or "").casefold().split())


def score_response(row: Dict[str, Any], payload: Dict[str, Any], elapsed: float) -> Dict[str, Any]:
    answer = str(payload.get("answer") or "")
    sources = [str(value) for value in (payload.get("sources") or [])]
    expected_facts = row.get("expected_contains", [])
    facts = [
        _normalized(expected) in _normalized(answer)
        for expected in expected_facts
    ]
    expected_sources = set(row.get("expected_sources", []))
    returned_sources = set(sources)
    source_hits = len(expected_sources & returned_sources)
    source_recall = source_hits / len(expected_sources) if expected_sources else None
    source_precision = source_hits / len(returned_sources) if returned_sources else (1.0 if not expected_sources else 0.0)
    should_refuse = bool(row.get("should_refuse", False))
    clarification_needed = bool(payload.get("clarification_needed", False))
    refused = should_refuse and clarification_needed and not sources
    forbidden_hits = [
        term for term in row.get("forbidden_terms", [])
        if _normalized(term) and _normalized(term) in _normalized(answer)
    ]
    expected_answerable = not should_refuse
    answer_ok = (all(facts) if facts else (bool(answer.strip()) and not clarification_needed))
    if expected_answerable and expected_sources:
        answer_ok = answer_ok and source_hits == len(expected_sources)
    return {
        "id": row["id"],
        "passed": bool((refused if should_refuse else answer_ok) and not forbidden_hits),
        "end_to_end_seconds": round(elapsed, 4),
        "answer_characters": len(answer),
        "clarification_needed": clarification_needed,
        "sources_returned": len(sources),
        "expected_fact_matches": sum(facts),
        "expected_facts": len(facts),
        "source_precision": round(source_precision, 4),
        "source_recall": round(source_recall, 4) if source_recall is not None else None,
        "refusal_expected": should_refuse,
        "refusal_correct": refused if should_refuse else None,
        "forbidden_term_hits": len(forbidden_hits),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--base-url", default=os.getenv("RAG_EVALUATION_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not args.dataset.is_file():
        print(f"Dataset not found: {args.dataset}", file=sys.stderr)
        return 2
    if not os.getenv("RAG_API_KEY", "").strip():
        print("RAG_API_KEY is required. Set it in the ignored root .env.", file=sys.stderr)
        return 2

    try:
        import httpx
    except ImportError:
        print("Install rag-service/requirements.txt first (httpx is required).", file=sys.stderr)
        return 2

    rows = load_dataset(args.dataset)
    latencies: List[float] = []
    details: List[Dict[str, Any]] = []
    failures = 0
    headers = {"X-RAG-API-Key": os.environ["RAG_API_KEY"]}
    timeout = httpx.Timeout(max(5.0, args.timeout), connect=min(10.0, max(5.0, args.timeout)))

    with httpx.Client(timeout=timeout) as client:
        for index, row in enumerate(rows, start=1):
            payload = {
                "question": row["question"],
                "user_id": row["user_id"],
                "scope": row["scope"],
                "top_k": int(row.get("top_k", 5)),
                "conversation_history": row.get("conversation_history", []),
            }
            started = time.perf_counter()
            try:
                response = client.post(
                    f"{args.base_url.rstrip('/')}/query",
                    json=payload,
                    headers=headers,
                )
                elapsed = time.perf_counter() - started
                latencies.append(elapsed)
                response.raise_for_status()
                result = score_response(row, response.json(), elapsed)
            except Exception as exc:
                failures += 1
                result = {
                    "id": row["id"],
                    "passed": False,
                    "error_type": type(exc).__name__,
                    "end_to_end_seconds": round(time.perf_counter() - started, 4),
                }
            details.append(result)
            print(f"[{index}/{len(rows)}] {'PASS' if result['passed'] else 'FAIL'} | {result['id']}")

    total_expected_facts = sum(item.get("expected_facts", 0) for item in details)
    matched_expected_facts = sum(item.get("expected_fact_matches", 0) for item in details)
    answerable = [item for item in details if not item.get("refusal_expected", False) and "error_type" not in item]
    refusals = [item for item in details if item.get("refusal_expected", False) and "error_type" not in item]
    source_precisions = [item["source_precision"] for item in details if "source_precision" in item]
    source_recalls = [item["source_recall"] for item in details if item.get("source_recall") is not None]
    report = {
        "dataset": args.dataset.name,
        "cases": len(rows),
        "passed_cases": sum(1 for item in details if item["passed"]),
        "failed_cases": sum(1 for item in details if not item["passed"]),
        "request_failures": failures,
        "metrics": {
            "expected_fact_match_rate": round(matched_expected_facts / total_expected_facts, 4) if total_expected_facts else None,
            "answerable_case_pass_rate": round(sum(bool(item["passed"]) for item in answerable) / len(answerable), 4) if answerable else None,
            "correct_refusal_rate": round(sum(bool(item.get("refusal_correct")) for item in refusals) / len(refusals), 4) if refusals else None,
            "mean_source_precision": round(statistics.mean(source_precisions), 4) if source_precisions else None,
            "mean_source_recall": round(statistics.mean(source_recalls), 4) if source_recalls else None,
            "forbidden_term_leakage_cases": sum(1 for item in details if item.get("forbidden_term_hits", 0)),
        },
        "end_to_end_latency_seconds": {
            "p50": percentile(latencies, 0.50),
            "p95": percentile(latencies, 0.95),
            "mean": round(statistics.mean(latencies), 4) if latencies else None,
        },
        "per_case": details,
        "limitations": [
            "Correctness is measured against manually supplied labels and expected substrings; a passing result is not a general proof of faithfulness.",
            "Source metrics use the API's source filenames and do not establish that every sentence is entailed by its cited source.",
            "Use two test identities and scope-specific fixtures to test real tenant isolation; do not commit those private test records or answers.",
        ],
    }
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    print("\n" + rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    return 1 if failures or report["failed_cases"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
