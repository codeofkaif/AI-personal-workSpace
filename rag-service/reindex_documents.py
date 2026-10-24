#!/usr/bin/env python3
"""Re-embed existing locally stored documents with the configured RAG embedding model.

Run from the repository root after setting DB_* and EMBEDDING_MODEL_NAME:
    python rag-service/reindex_documents.py
Preview inputs without modifying indexes:
    python rag-service/reindex_documents.py --dry-run

This script deliberately refuses to continue when original files are missing. Re-upload
missing files through the application instead of silently losing document coverage.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

SERVICE_DIR = Path(__file__).resolve().parent
ROOT_DIR = SERVICE_DIR.parent
sys.path.insert(0, str(SERVICE_DIR))

from main import (  # noqa: E402
    EMBEDDING_MODEL_NAME,
    CHUNK_SIZE_TOKENS,
    CHUNK_OVERLAP_TOKENS,
    chunk_text,
    ensure_chunk_schema,
    extract_pages_from_file,
    get_db_connection,
    get_embeddings,
    logger,
)


def resolve_document_path(file_url: str, upload_dir: Path) -> Path:
    """Resolve only the stored filename under the configured upload directory."""
    return (upload_dir / Path(file_url).name).resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Compute chunks/embeddings, do not change DB rows")
    parser.add_argument(
        "--upload-dir",
        default=os.getenv("DOCUMENT_UPLOAD_DIR", str(ROOT_DIR / "backend" / "uploads")),
        help="Directory containing files saved by DocumentService",
    )
    args = parser.parse_args()
    upload_dir = Path(args.upload_dir).expanduser().resolve()
    if not upload_dir.is_dir():
        print(f"Upload directory not found: {upload_dir}", file=sys.stderr)
        return 2

    conn = get_db_connection()
    if conn is None:
        print("Database connection failed; no documents were changed.", file=sys.stderr)
        return 2

    succeeded = 0
    skipped = 0
    failed = 0
    try:
        # A dry run must not alter schema or chunk metadata.
        if not args.dry_run:
            ensure_chunk_schema(conn)
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, file_url, user_id, is_college_doc
            FROM documents
            ORDER BY id
        """)
        documents = cur.fetchall()
        cur.close()
        print(f"Embedding model: {EMBEDDING_MODEL_NAME}")
        print(f"Chunk strategy: paragraph/token v2, target={CHUNK_SIZE_TOKENS}, overlap={CHUNK_OVERLAP_TOKENS}")
        print(f"Documents discovered: {len(documents)}; dry_run={args.dry_run}")

        for document_id, title, file_url, user_id, is_college_doc in documents:
            if not file_url:
                skipped += 1
                print(f"SKIP id={document_id} title={title!r}: no stored file_url")
                continue
            path = resolve_document_path(file_url, upload_dir)
            if not path.is_file():
                skipped += 1
                print(f"SKIP id={document_id} title={title!r}: file not found at {path}")
                continue

            try:
                file_bytes = path.read_bytes()
                pages = [(page, text) for page, text in extract_pages_from_file(file_bytes, title or path.name) if text.strip()]
                records = [(page, chunk) for page, text in pages for chunk in chunk_text(text)]
                if not records:
                    skipped += 1
                    print(f"SKIP id={document_id} title={title!r}: no readable text (scanned PDFs need OCR)")
                    continue
                vectors = get_embeddings([chunk for _, chunk in records])
                if args.dry_run:
                    succeeded += 1
                    print(f"DRY-RUN id={document_id} title={title!r}: {len(records)} chunks validated")
                    continue

                cur = conn.cursor()
                # Each document is replaced atomically; the previous index remains if inserting fails.
                cur.execute("SELECT id FROM documents WHERE id = %s FOR UPDATE", (document_id,))
                if cur.fetchone() is None:
                    raise RuntimeError("document record disappeared during reindex")
                cur.execute("DELETE FROM document_chunks WHERE document_id = %s", (document_id,))
                metadata = {
                    "filename": title or path.name,
                    "user_id": user_id,
                    "document_id": document_id,
                    "is_college_doc": bool(is_college_doc),
                    "embedding_model": EMBEDDING_MODEL_NAME,
                    "chunking_version": "paragraph-token-v2",
                    "chunk_size_tokens": CHUNK_SIZE_TOKENS,
                    "chunk_overlap_tokens": CHUNK_OVERLAP_TOKENS,
                }
                import json
                metadata_json = json.dumps(metadata)
                for index, ((page_number, content), vector) in enumerate(zip(records, vectors)):
                    cur.execute(
                        """INSERT INTO document_chunks
                           (content, metadata, page_number, chunk_index, document_id, embedding, embedding_model)
                           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                        (content, metadata_json, page_number, index, document_id, vector, EMBEDDING_MODEL_NAME),
                    )
                conn.commit()
                cur.close()
                succeeded += 1
                print(f"OK id={document_id} title={title!r}: {len(records)} chunks")
            except Exception as exc:
                conn.rollback()
                failed += 1
                logger.exception("Reindex failed for document id=%s", document_id)
                print(f"FAIL id={document_id} title={title!r}: {exc}", file=sys.stderr)

        print(f"\nSummary: succeeded={succeeded}, skipped={skipped}, failed={failed}")
        if args.dry_run:
            print("Dry run only: the database index was not modified.")
        return 1 if failed else 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
