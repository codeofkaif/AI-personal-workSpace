from pathlib import Path
import json
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from benchmark_embedding_models import load_dataset, ranking_metrics


def test_ranking_metrics_perfect_rank():
    result = ranking_metrics(["relevant", "other", "irrelevant"], {"relevant"})
    assert result["recall_at_5"] == 1.0
    assert result["recall_at_10"] == 1.0
    assert result["mrr_at_10"] == 1.0
    assert result["ndcg_at_10"] == 1.0


def test_ranking_metrics_penalizes_late_relevant_chunk():
    result = ranking_metrics(["x", "y", "relevant"], {"relevant"})
    assert result["mrr_at_10"] == pytest.approx(1 / 3)
    assert result["ndcg_at_10"] < 1.0


def test_dataset_loader_requires_manual_gold_relevance(tmp_path):
    path = tmp_path / "dataset.jsonl"
    path.write_text(json.dumps({
        "question": "Where is my contact info?",
        "documents": [{"id": "a", "text": "Some source text"}],
    }) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match="relevant_ids"):
        load_dataset(path)


def test_dataset_loader_checks_relevant_ids_exist(tmp_path):
    path = tmp_path / "dataset.jsonl"
    path.write_text(json.dumps({
        "question": "Where is my contact info?",
        "documents": [{"id": "a", "text": "Some source text"}],
        "relevant_ids": ["missing"],
    }) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match="refer to document IDs"):
        load_dataset(path)
