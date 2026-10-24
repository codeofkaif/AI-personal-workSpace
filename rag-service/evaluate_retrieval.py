#!/usr/bin/env python3
"""Evaluate retrieval ranking and latency using a manually verified JSONL dataset.

Each line must be JSON:
{"question":"What is the exam date?","user_id":12,"scope":"College + Personal","relevant_chunk_ids":[18,27]}

Gold chunk IDs must come from a trusted, manually checked relevance assessment.
Run from the repository root:
  python rag-service/evaluate_retrieval.py rag-service/evaluation/questions.jsonl
"""
from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
import time
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SERVICE_DIR))

from main import EMBEDDING_MODEL_NAME, get_embedding, retrieve_context  # noqa: E402


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(fraction * len(ordered)) - 1))
    return round(ordered[index], 4)


def ndcg_at_k(retrieved_ids: list[int], relevant_ids: set[int], k: int) -> float:
    if not relevant_ids:
        return 0.0
    dcg = sum(1.0 / math.log2(rank + 1) for rank, chunk_id in enumerate(retrieved_ids[:k], start=1)
              if chunk_id in relevant_ids)
    ideal_hits = min(len(relevant_ids), k)
    ideal = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
    return dcg / ideal if ideal else 0.0


def load_dataset(path: Path) -> list[dict]:
    rows = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON at line {line_no}: {exc}") from exc
        if not isinstance(row.get("question"), str) or not row["question"].strip():
            raise ValueError(f"Line {line_no} needs a non-empty question.")
        if not isinstance(row.get("user_id"), int) or row["user_id"] <= 0:
            raise ValueError(f"Line {line_no} needs the real authenticated user_id for scope-safe evaluation.")
        rows.append(row)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="JSONL questions dataset")
    parser.add_argument("--top-k", type=int, default=10, choices=range(1, 11))
    parser.add_argument("--output", type=Path, help="Optional path for per-question JSON results")
    args = parser.parse_args()
    if not args.dataset.is_file():
        print(f"Dataset not found: {args.dataset}", file=sys.stderr)
        return 2

    rows = load_dataset(args.dataset)
    if not rows:
        print("Dataset is empty; no evaluation was run.", file=sys.stderr)
        return 2

    latencies = []
    recall5 = []
    mrr10 = []
    ndcg5 = []
    scored = 0
    details = []
    for index, row in enumerate(rows, start=1):
        started = time.perf_counter()
        vector = get_embedding(row["question"], is_query=True)
        contexts = retrieve_context(
            row["question"], vector, row["user_id"],
            row.get("scope", "College + Personal"), args.top_k
        )
        elapsed = time.perf_counter() - started
        latencies.append(elapsed)
        ids = [int(item["id"]) for item in contexts if item.get("id") is not None]
        relevant = {int(value) for value in row.get("relevant_chunk_ids", [])}
        detail = {
            "index": index,
            "question": row["question"],
            "elapsed_seconds": round(elapsed, 4),
            "retrieved_chunk_ids": ids,
            "source_files": list(dict.fromkeys(item.get("filename", "Document") for item in contexts)),
        }
        if relevant:
            scored += 1
            hits5 = sum(1 for chunk_id in ids[:5] if chunk_id in relevant)
            recall5.append(hits5 / len(relevant))
            positions = [rank for rank, chunk_id in enumerate(ids[:10], start=1) if chunk_id in relevant]
            mrr10.append(1.0 / positions[0] if positions else 0.0)
            ndcg5.append(ndcg_at_k(ids, relevant, 5))
            detail["relevant_chunk_ids"] = sorted(relevant)
            detail["recall_at_5"] = round(recall5[-1], 4)
            detail["mrr_at_10"] = round(mrr10[-1], 4)
            detail["ndcg_at_5"] = round(ndcg5[-1], 4)
        details.append(detail)
        print(f"[{index}/{len(rows)}] {elapsed:.3f}s | {len(ids)} chunks | {row['question'][:90]}")

    report = {
        "embedding_model": EMBEDDING_MODEL_NAME,
        "questions": len(rows),
        "questions_with_gold_chunk_ids": scored,
        "retrieval_latency_seconds": {
            "p50": percentile(latencies, 0.50),
            "p95": percentile(latencies, 0.95),
            "mean": round(statistics.mean(latencies), 4),
        },
        "metrics": {
            "recall_at_5": round(statistics.mean(recall5), 4) if recall5 else None,
            "mrr_at_10": round(statistics.mean(mrr10), 4) if mrr10 else None,
            "ndcg_at_5": round(statistics.mean(ndcg5), 4) if ndcg5 else None,
        },
        "per_question": details,
        "note": "Retrieval-only metrics. Answer correctness and citation entailment require a separately verified answer-level evaluation.",
    }
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    print("\n" + rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
