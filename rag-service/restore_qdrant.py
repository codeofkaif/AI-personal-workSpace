#!/usr/bin/env python3
"""Restore a Qdrant snapshot into a new, model-compatible collection without overwriting data."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
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
    parser.add_argument("snapshot", type=Path, help="Path to a collection .snapshot file")
    parser.add_argument(
        "--target-collection",
        help="New collection name; must include the configured model and dimension. Defaults to QDRANT_COLLECTION_NAME.",
    )
    args = parser.parse_args()
    try:
        import httpx
    except ImportError:
        print("httpx is required; install rag-service/requirements.txt.", file=sys.stderr)
        return 2

    snapshot = args.snapshot.expanduser().resolve()
    if not snapshot.is_file() or snapshot.stat().st_size == 0:
        print("Snapshot file is missing or empty.", file=sys.stderr)
        return 2

    try:
        model_name, dimension, configured_collection = get_embedding_config()
    except Exception as exc:
        print(f"Invalid embedding/Qdrant configuration: {exc}", file=sys.stderr)
        return 2

    target = (args.target_collection or configured_collection).strip()
    model_token = model_name.lower().replace("-", "_").replace(".", "_")
    if not target or model_token not in target.lower() or str(dimension) not in target:
        print(
            f"Target collection must include model token {model_token!r} and dimension {dimension}.",
            file=sys.stderr,
        )
        return 2
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", target):
        print("Target collection contains unsupported characters.", file=sys.stderr)
        return 2

    manifest_path = snapshot.with_suffix(snapshot.suffix + ".json")
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception:
            print("Snapshot manifest could not be parsed; refusing to restore.", file=sys.stderr)
            return 2
        expected_sha = str(manifest.get("sha256") or "")
        actual_sha = hashlib.sha256(snapshot.read_bytes()).hexdigest()
        if not expected_sha or expected_sha != actual_sha:
            print("Snapshot SHA-256 does not match its manifest; refusing to restore.", file=sys.stderr)
            return 2
        if manifest.get("embedding_model") != model_name or int(manifest.get("embedding_dimension", -1)) != dimension:
            print("Snapshot model/dimension differs from configured model space; refusing to restore.", file=sys.stderr)
            return 2
        print(f"Verified snapshot checksum from {manifest_path.name}")
    else:
        print("Warning: no sidecar manifest was found; only the restored vector schema will be checked.")

    base_url = os.getenv("QDRANT_URL", "http://localhost:6333").strip().rstrip("/")
    api_key = os.getenv("QDRANT_API_KEY", "").strip()
    headers = {"api-key": api_key} if api_key else {}
    timeout = httpx.Timeout(300.0, connect=10.0)
    target_path = quote(target, safe="")

    try:
        with httpx.Client(base_url=base_url, headers=headers, timeout=timeout) as client:
            existing = client.get(f"/collections/{target_path}")
            if existing.status_code == 200:
                print(
                    f"Target collection {target!r} already exists. "
                    "Restore into a different collection name; this tool never overwrites it.",
                    file=sys.stderr,
                )
                return 2
            if existing.status_code != 404:
                existing.raise_for_status()

            with snapshot.open("rb") as handle:
                response = client.post(
                    f"/collections/{target_path}/snapshots/upload",
                    params={"priority": "snapshot"},
                    files={"snapshot": (snapshot.name, handle, "application/octet-stream")},
                )
            response.raise_for_status()

            verify = client.get(f"/collections/{target_path}")
            verify.raise_for_status()
            result = verify.json().get("result", {})
            params = result.get("config", {}).get("params", {})
            vectors = params.get("vectors", {})
            dense = vectors.get("dense") if isinstance(vectors, dict) else None
            if not isinstance(dense, dict) or int(dense.get("size", -1)) != dimension:
                print(
                    f"Snapshot restored to {target!r}, but its dense vector size did not match {dimension}. "
                    "Do not route production queries to this collection until it is investigated.",
                    file=sys.stderr,
                )
                return 1
            sparse_vectors = params.get("sparse_vectors", {})
            if "sparse" not in sparse_vectors:
                print(
                    f"Snapshot restored to {target!r}, but the required sparse vector is missing. "
                    "Do not route production queries to this collection.",
                    file=sys.stderr,
                )
                return 1
            print(
                f"Snapshot restored to new collection {target!r}; schema validated "
                f"(model={model_name}, dimension={dimension})."
            )
            print("Update QDRANT_COLLECTION_NAME and restart the service only after query/ACL verification.")
            return 0
    except Exception as exc:
        print(f"Snapshot restore failed ({type(exc).__name__}); inspect Qdrant logs and collection state.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
