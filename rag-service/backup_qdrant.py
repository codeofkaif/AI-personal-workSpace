#!/usr/bin/env python3
"""Create and download a local Qdrant collection snapshot with a SHA-256 manifest."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

SERVICE_DIR = Path(__file__).resolve().parent
ROOT_DIR = SERVICE_DIR.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
except ImportError:
    pass

sys.path.insert(0, str(SERVICE_DIR))
from vector_store import get_embedding_config  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT_DIR / "backups" / "qdrant",
        help="Directory for the snapshot and sidecar manifest (ignored by Git)",
    )
    args = parser.parse_args()
    try:
        import httpx
    except ImportError:
        print("httpx is required; install rag-service/requirements.txt.", file=sys.stderr)
        return 2

    try:
        model_name, dimension, collection = get_embedding_config()
    except Exception as exc:
        print(f"Invalid embedding/Qdrant configuration: {exc}", file=sys.stderr)
        return 2

    base_url = os.getenv("QDRANT_URL", "http://localhost:6333").strip().rstrip("/")
    api_key = os.getenv("QDRANT_API_KEY", "").strip()
    headers = {"api-key": api_key} if api_key else {}
    timeout = httpx.Timeout(120.0, connect=10.0)
    collection_path = quote(collection, safe="")

    try:
        with httpx.Client(base_url=base_url, headers=headers, timeout=timeout) as client:
            collection_response = client.get(f"/collections/{collection_path}")
            if collection_response.status_code == 404:
                print(f"Collection {collection!r} does not exist; no snapshot was made.", file=sys.stderr)
                return 2
            collection_response.raise_for_status()
            snapshot_response = client.post(
                f"/collections/{collection_path}/snapshots",
                params={"wait": "true"},
            )
            snapshot_response.raise_for_status()
            snapshot_name = snapshot_response.json()["result"]["name"]
            download_response = client.get(
                f"/collections/{collection_path}/snapshots/{quote(snapshot_name, safe='')}"
            )
            download_response.raise_for_status()
            snapshot_bytes = download_response.content
    except Exception as exc:
        print(f"Qdrant snapshot failed ({type(exc).__name__}); verify QDRANT_URL and service logs.", file=sys.stderr)
        return 1

    if not snapshot_bytes:
        print("Qdrant returned an empty snapshot; refusing to save it.", file=sys.stderr)
        return 1

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_collection = re.sub(r"[^A-Za-z0-9_.-]+", "_", collection)
    args.output_dir.expanduser().mkdir(parents=True, exist_ok=True)
    snapshot_path = args.output_dir.expanduser().resolve() / f"{safe_collection}_{timestamp}.snapshot"
    temp_path = snapshot_path.with_suffix(snapshot_path.suffix + ".partial")
    try:
        temp_path.write_bytes(snapshot_bytes)
        os.replace(temp_path, snapshot_path)
        manifest = {
            "collection": collection,
            "embedding_model": model_name,
            "embedding_dimension": dimension,
            "qdrant_snapshot_name": snapshot_name,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "bytes": len(snapshot_bytes),
            "sha256": hashlib.sha256(snapshot_bytes).hexdigest(),
            "snapshot_file": snapshot_path.name,
        }
        manifest_path = snapshot_path.with_suffix(snapshot_path.suffix + ".json")
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    except Exception as exc:
        temp_path.unlink(missing_ok=True)
        print(f"Could not persist the snapshot ({type(exc).__name__}).", file=sys.stderr)
        return 1

    print(f"Snapshot saved: {snapshot_path}")
    print(f"SHA-256: {manifest['sha256']}")
    print(f"Manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
