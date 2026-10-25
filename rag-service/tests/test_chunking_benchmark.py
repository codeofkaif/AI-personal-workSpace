from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from benchmark_chunking import _coverage_ratio, _fact_spans, _parse_config


def test_chunking_benchmark_parses_valid_configs():
    assert _parse_config("450:60") == (450, 60)
    assert _parse_config("250:30") == (250, 30)


def test_chunking_benchmark_rejects_invalid_overlap():
    with pytest.raises(Exception):
        _parse_config("450:160")
    with pytest.raises(Exception):
        _parse_config("40:5")


def test_chunking_coverage_metric_detects_source_token_coverage():
    assert _coverage_ratio("Mobile: 98765 43210", ["Mobile: 98765", "43210"]) == 1.0
    assert _coverage_ratio("", []) == 1.0


def test_chunking_benchmark_detects_exact_fact_spans_without_returning_values():
    spans = _fact_spans("Mobile: +91 98765-43210 and email kaif@example.test")
    assert len(spans) == 2
