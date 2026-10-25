#!/usr/bin/env python3
"""Benchmark chunk sizes/overlaps locally without embedding calls or index writes.

The report omits source text and extracted facts. By default it reads local original
uploads under backend/uploads and analyses the configured chunker with several settings.

Run from repository root:
  python rag-service/benchmark_chunking.py
  python rag-service/benchmark_chunking.py --source-dir /path/to/redacted/corpus --configs 250:30 350:50 450:60 600:80
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

SERVICE_DIR = Path(__file__).resolve().parent
ROOT_DIR = SERVICE_DIR.parent
sys.path.insert(0, str(SERVICE_DIR))

import main  # noqa: E402
from document_parser import SUPPORTED_EXTENSIONS, extract_document_pages  # noqa: E402
from vector_store import get_text_tokenizer  # noqa: E402

FACT_PATTERNS = (
    re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"),
    re.compile(r"(?:\+91[\s-]*)?[6-9](?:[\s-]*\d){9}"),
    re.compile(r"\b(?:roll|enrollment|student\s*id|registration)\s*(?:number|no\.?|id|code)?[:\s#-]*[A-Za-z0-9/-]{3,}\b", re.I),
    re.compile(r"\b(?:dob|date\s+of\s+birth|date|exam\s+date)[:\s-]*\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b", re.I),
)


def _token_count(text: str, tokenizer) -> int:
    if tokenizer is not None:
        try:
            return len(tokenizer.encode(text, add_special_tokens=False))
        except Exception:
            pass
    return len(re.findall(r"\S+", text or ""))


def _fact_spans(text: str) -> List[str]:
    spans: List[str] = []
    for pattern in FACT_PATTERNS:
        spans.extend(match.group(0) for match in pattern.finditer(text or ""))
    return spans


def _coverage_ratio(source: str, chunks: Sequence[str]) -> float:
    """Approximate source-token coverage using token multisets without saving text."""
    source_tokens = re.findall(r"\w+|[^\w\s]", source or "", re.UNICODE)
    if not source_tokens:
        return 1.0
    counts = Counter(token.casefold() for token in source_tokens)
    chunk_counts = Counter(
        token.casefold()
        for chunk in chunks
        for token in re.findall(r"\w+|[^\w\s]", chunk or "", re.UNICODE)
    )
    covered = sum(min(amount, chunk_counts[token]) for token, amount in counts.items())
    return covered / len(source_tokens)


def _parse_config(value: str) -> Tuple[int, int]:
    try:
        size_text, overlap_text = value.split(":", 1)
        size, overlap = int(size_text), int(overlap_text)
    except Exception as exc:
        raise argparse.ArgumentTypeError("Config must be SIZE:OVERLAP, for example 450:60.") from exc
    if size < 64 or overlap < 0 or overlap > size // 3:
        raise argparse.ArgumentTypeError("Require SIZE>=64 and 0<=OVERLAP<=SIZE/3.")
    return size, overlap


def load_sources(root: Path) -> List[Dict[str, Any]]:
    if not root.is_dir():
        raise FileNotFoundError(f"Source directory does not exist: {root}")
    sources: List[Dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        try:
            file_bytes = path.read_bytes()
            pages = extract_document_pages(file_bytes, path.name)
            texts = [text for _, text in pages if text and text.strip()]
            source = "\n\n".join(texts).strip()
            if not source:
                continue
            sources.append({
                "source_id": str(path.relative_to(root)),
                "text": main.enrich_text_for_index(source),
                "original_text": source,
                "pages": len(pages),
            })
        except Exception as exc:
            # Report the relative path + failure class, never the document text.
            sources.append({
                "source_id": str(path.relative_to(root)),
                "error_type": type(exc).__name__,
                "pages": 0,
                "text": "",
                "original_text": "",
            })
    return sources


def benchmark_config(
    sources: Sequence[Dict[str, Any]],
    chunk_size: int,
    overlap: int,
    tokenizer,
) -> Dict[str, Any]:
    old_size = main.CHUNK_SIZE_TOKENS
    old_overlap = main.CHUNK_OVERLAP_TOKENS
    old_backend = main.RAG_VECTOR_BACKEND
    main.CHUNK_SIZE_TOKENS = chunk_size
    main.CHUNK_OVERLAP_TOKENS = overlap
    # The local tokenizer path avoids loading a SentenceTransformer/Gemini model.
    main.RAG_VECTOR_BACKEND = "qdrant"

    counts: List[int] = []
    chunk_sizes: List[int] = []
    overflow_chunks = 0
    coverage_values: List[float] = []
    fact_total = 0
    fact_preserved = 0
    errors: List[Dict[str, str]] = []
    try:
        for source in sources:
            if source.get("error_type"):
                errors.append({"source_id": source["source_id"], "error_type": source["error_type"]})
                continue
            text = source["text"]
            chunks = main.chunk_text(text, chunk_size=chunk_size, overlap=overlap)
            counts.append(len(chunks))
            chunk_sizes.extend(_token_count(chunk, tokenizer) for chunk in chunks)
            overflow_chunks += sum(
                _token_count(chunk, tokenizer) > chunk_size
                for chunk in chunks
            )
            coverage_values.append(_coverage_ratio(source["original_text"], chunks))
            fact_spans = _fact_spans(source["original_text"])
            fact_total += len(fact_spans)
            fact_preserved += sum(
                any(span in chunk for chunk in chunks)
                for span in fact_spans
            )
    finally:
        main.CHUNK_SIZE_TOKENS = old_size
        main.CHUNK_OVERLAP_TOKENS = old_overlap
        main.RAG_VECTOR_BACKEND = old_backend

    return {
        "chunk_size_tokens": chunk_size,
        "overlap_tokens": overlap,
        "documents_processed": len(counts),
        "documents_with_parse_errors": len(errors),
        "total_chunks": sum(counts),
        "mean_chunks_per_document": round(statistics.mean(counts), 3) if counts else 0,
        "mean_chunk_tokens": round(statistics.mean(chunk_sizes), 3) if chunk_sizes else 0,
        "p95_chunk_tokens": round(sorted(chunk_sizes)[min(len(chunk_sizes) - 1, int(0.95 * len(chunk_sizes)))] , 3) if chunk_sizes else 0,
        "chunks_over_configured_size": overflow_chunks,
        "estimated_source_token_coverage": round(statistics.mean(coverage_values), 4) if coverage_values else None,
        "exact_fact_spans": fact_total,
        "exact_fact_spans_preserved_in_one_chunk": fact_preserved,
        "exact_fact_containment_rate": round(fact_preserved / fact_total, 4) if fact_total else None,
        "parse_errors": errors,
        "note": "Coverage and token counts are diagnostic approximations. Retrieval Recall@K/MRR/nDCG must be measured separately on manually labelled queries.",
    }


def main_cli() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=ROOT_DIR / "backend" / "uploads",
        help="Directory containing original files; the script only reads files.",
    )
    parser.add_argument(
        "--configs",
        nargs="+",
        type=_parse_config,
        default=[(250, 30), (350, 50), (450, 60), (600, 80)],
    )
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    try:
        sources = load_sources(args.source_dir.expanduser().resolve())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 2
    if not sources:
        print("No supported source documents found. No chunks or index data were changed.", file=sys.stderr)
        return 2

    tokenizer = get_text_tokenizer()
    results = [
        benchmark_config(sources, size, overlap, tokenizer)
        for size, overlap in args.configs
    ]
    report = {
        "source_directory": str(args.source_dir.expanduser().resolve()),
        "sources_found": len(sources),
        "successful_sources": sum(1 for item in sources if not item.get("error_type")),
        "failed_sources": sum(1 for item in sources if item.get("error_type")),
        "embedding_api_called": False,
        "vector_database_modified": False,
        "configuration_results": results,
        "recommendation": (
            "Choose a candidate configuration using coverage, fact containment and chunk-count trade-offs; "
            "then compare Recall@5/10, MRR and nDCG on the same labelled query dataset before production rollout."
        ),
    }
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    print(rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    return 1 if report["failed_sources"] else 0


if __name__ == "__main__":
    raise SystemExit(main_cli())
