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
    RAG_VECTOR_BACKEND,
    CHUNK_SIZE_TOKENS,
    CHUNK_OVERLAP_TOKENS,
    CHUNKING_VERSION,
    chunk_text,
    ensure_chunk_schema,
    extract_pages_from_file,
    enrich_text_for_index,
    get_db_connection,
    get_embeddings,
    logger,
)


def resolve_document_path(file_url: str, upload_dir: Path) -> Path:
    """Resolve only the stored filename under the configured upload directory."""
    return (upload_dir / Path(file_url).name).resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Validate source parsing/chunking without modifying indexes or calling Gemini")
    parser.add_argument(
        "--verify-embeddings",
        action="store_true",
        help="Explicitly call the configured embedding provider during --dry-run (requires API credentials)",
    )
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
        if not args.dry_run and RAG_VECTOR_BACKEND == "pgvector":
            ensure_chunk_schema(conn)
        cur = conn.cursor()
        cur.execute("""
            SELECT d.id, d.title, d.file_url, d.user_id, d.is_college_doc,
                   COALESCE(d.college_id, u.college_id) AS college_id
            FROM documents d
            LEFT JOIN users u ON u.id = d.user_id
            ORDER BY d.id
        """)
        documents = cur.fetchall()
        cur.close()
        print(f"Embedding model: {EMBEDDING_MODEL_NAME}")
        print(f"Chunk strategy: heading-paragraph-token-v3, target={CHUNK_SIZE_TOKENS}, overlap={CHUNK_OVERLAP_TOKENS}")
        print(f"Documents discovered: {len(documents)}; dry_run={args.dry_run}")

        for document_id, title, file_url, user_id, is_college_doc, college_id in documents:
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
                pages = [
                    (page, enrich_text_for_index(text))
                    for page, text in extract_pages_from_file(file_bytes, title or path.name)
                    if text.strip()
                ]
                records = [(page, chunk) for page, text in pages for chunk in chunk_text(text)]
                if not records:
                    skipped += 1
                    print(f"SKIP id={document_id} title={title!r}: no readable text (scanned PDFs need OCR)")
                    continue
                chunk_texts = [chunk for _, chunk in records]
                if args.dry_run and not args.verify_embeddings:
                    succeeded += 1
                    print(
                        f"DRY-RUN id={document_id} title={title!r}: "
                        f"{len(records)} chunks validated; embeddings skipped"
                    )
                    continue
                if RAG_VECTOR_BACKEND == "qdrant":
                    vectors = get_embeddings(chunk_texts, titles=[title or path.name] * len(chunk_texts))
                else:
                    vectors = get_embeddings(chunk_texts)
                if args.dry_run:
                    succeeded += 1
                    print(
                        f"DRY-RUN id={document_id} title={title!r}: "
                        f"{len(records)} chunks and embeddings validated"
                    )
                    continue

                cur = conn.cursor()
                # Verify the source row still exists and is stable before replacing the index.
                cur.execute(
                    """
                    SELECT d.user_id, d.is_college_doc,
                           COALESCE(d.college_id, u.college_id) AS college_id
                    FROM documents d
                    LEFT JOIN users u ON u.id = d.user_id
                    WHERE d.id = %s
                    FOR UPDATE OF d
                    """,
                    (document_id,),
                )
                current_metadata = cur.fetchone()
                if current_metadata is None:
                    raise RuntimeError("document record disappeared during reindex")
                current_user_id, current_college_scope, current_college_id = current_metadata
                if (
                    int(current_user_id) != int(user_id)
                    or bool(current_college_scope) != bool(is_college_doc)
                    or (
                        current_college_id is not None and college_id is not None
                        and int(current_college_id) != int(college_id)
                    )
                ):
                    raise RuntimeError(
                        "document owner/college scope changed while embeddings were being computed; "
                        "retry the reindex after reviewing document metadata"
                    )
                user_id = int(current_user_id)
                is_college_doc = bool(current_college_scope)
                college_id = current_college_id

                if RAG_VECTOR_BACKEND == "qdrant":
                    from vector_store import upsert_document_chunks
                    if bool(is_college_doc) and college_id is None:
                        raise RuntimeError("college-scoped document has no verified college_id")
                    items = [
                        {
                            "content": content,
                            "filename": title or path.name,
                            "user_id": int(user_id),
                            "document_id": int(document_id),
                            "document_key": f"document:{document_id}",
                            "is_college_doc": bool(is_college_doc),
                            "college_id": int(college_id) if college_id is not None and bool(is_college_doc) else None,
                            "page_number": page_number,
                            "chunk_index": index,
                        }
                        for index, (page_number, content) in enumerate(records)
                    ]
                    upsert_document_chunks(items, vectors)
                    conn.commit()
                    cur.close()
                    succeeded += 1
                    print(f"OK id={document_id} title={title!r}: {len(records)} Qdrant chunks")
                    continue

                cur.execute("DELETE FROM document_chunks WHERE document_id = %s", (document_id,))
                metadata = {
                    "filename": title or path.name,
                    "user_id": user_id,
                    "document_id": document_id,
                    "is_college_doc": bool(is_college_doc),
                    "embedding_model": EMBEDDING_MODEL_NAME,
                    "chunking_version": CHUNKING_VERSION,
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
        return 1 if failed or skipped else 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
