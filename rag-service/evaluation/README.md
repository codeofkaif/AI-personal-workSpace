# RAG evaluation datasets

## Synthetic embedding-model smoke benchmark

`embedding_benchmark_sample.jsonl` is a public, synthetic smoke dataset with English, Hindi, Hinglish, typos, exact IDs, personal-document queries and table-related questions. Values and names are examples, not real-user records.

Run from the repository root after installing `rag-service/requirements.txt` and setting `GEMINI_API_KEY` in the ignored root `.env`:

```bash
python rag-service/benchmark_embedding_models.py \
  rag-service/evaluation/embedding_benchmark_sample.jsonl \
  --models gemini-embedding-2 gemini-embedding-001 \
  --dimension 768 \
  --output rag-service/evaluation/embedding-benchmark-report.json
```

The script compares Recall@5/10, MRR@10, nDCG@10 and embedding latency on identical labelled examples. It reports request counts and embedded characters but does not invent a monetary cost; check the provider usage dashboard for actual token usage and cost.

**Do not select a production model from the synthetic dataset alone.** Curate a representative dataset from consented, redacted document chunks and real expected-answer labels without committing private documents, phone numbers, emails, or user identifiers. Use the same questions and ground-truth relevance labels for both models. Benchmark with the production chunking strategy and add a separate end-to-end run after reindexing into each model's separate Qdrant collection.

## Full-system retrieval evaluation

For the complete currently deployed retrieval path, see the root README section “Retrieval evaluation”. Its JSONL schema uses `relevant_chunk_ids` from the active indexed corpus and a real authenticated `user_id`; do not put private document content in the report.
