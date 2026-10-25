# 🎓 AI Personal Workspace (Campus Copilot)

> **AI-powered personal and institutional workspace for college-scoped knowledge, private user documents, productivity, and source-grounded AI assistance.**

[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Spring Boot](https://img.shields.io/badge/Backend-Spring%20Boot%203.3.5-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![FastAPI](https://img.shields.io/badge/AI%20Service-FastAPI%20%2B%20PyTorch-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Metadata-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/) [![Qdrant](https://img.shields.io/badge/Vector%20DB-Qdrant-DC244C)](https://qdrant.tech/)

---

## 🌟 Overview

**AI Personal Workspace** is a unified academic workspace designed for colleges and universities. It bridges the gap between campus administration, faculty, and students by combining role-based workspaces with an AI assistant capable of answering questions from syllabi, campus notices, lecture notes, and official university circulars.

The core principle of the platform:
> **College knowledge is shared across permitted college members, while personal knowledge remains strictly private to the user.**

---

## 🏛️ System Architecture & Four Pillars

The system is built upon four robust, decoupled pillars:

```text
┌────────────────────────────────────────────────────────┐
│               Frontend (React 19 + Vite)               │
│         Tailwind CSS • Lucide Icons • React Router     │
└───────────────▲────────────────────────▲───────────────┘
                │ REST (JWT)             │ (Optional direct)
                ▼                        │
┌───────────────────────────────┐        │
│  Backend (Spring Boot 3.3.5)  │        │
│  Java 21 • Spring Security    │        │
│  Spring Data JPA • PostgreSQL │        ▼
└───────────────▲───────────────┴────────────────────────┐
                │ Internal HTTP / Document Ingestion     │
                ▼                                        ▼
┌────────────────────────────────────────────────────────┐
│             AI Service (FastAPI + Python)              │
│  Gemini Embeddings • Qdrant Hybrid Search • Ollama LLM │
└────────────────────────────────────────────────────────┘
```

1. **Frontend (React 19 + Vite + Tailwind CSS)**: Intuitive, high-performance web interface tailored by role (Student, Faculty, HOD, Dean).
2. **Backend (Spring Boot 3.3.5 + Java 21)**: Enterprise-grade REST API, JWT authentication, role-based authorization, database transactions, and business logic.
3. **AI / RAG Service (FastAPI + Python 3.10+)**: Structure-aware parsing, token-aware chunking, Google Gemini embeddings, Qdrant dense + sparse hybrid retrieval, optional cross-encoder reranking, recovery search, and grounded local-LLM answers with source citations.
4. **Data Stores**: PostgreSQL remains the source of truth for users, documents and access control. Qdrant stores versioned vectors and chunk payloads for hybrid retrieval.

---

## 📐 Architecture & Design Documentation

Detailed architectural blueprints are maintained in the [`docs/architecture/`](docs/architecture/) folder:

- **Project High-Level Design (HLD)**: [`ProjectHLD.png`](docs/architecture/ProjectHLD.png)
- **Frontend Architecture & LLD**: [`frontEnd_design.png`](docs/architecture/frontEnd_design.png)
- **Backend Architecture & LLD**: [`BackendDesign.png`](docs/architecture/BackendDesign.png)
- **AI & RAG Pipeline Design**: [`Ai:RAG_Design.png`](docs/architecture/Ai:RAG_Design.png)
- **Database Schema & Entity Relations**: [`DataBaseDesign.png`](docs/architecture/DataBaseDesign.png)

---

## ⚡ Key Features

- 🤖 **Context-Aware AI Assistant (RAG)**: Ask questions directly against uploaded documents, campus circulars, and course syllabi with grounded answers and source citations.
- 🔐 **Role-Based Access Control (RBAC)**:
  - **Student**: AI study buddy, personal notes, course document Q&A, timetable, notice board.
  - **Faculty**: Class notices, subject document distribution, student attendance & performance analytics.
  - **HOD (Head of Department)**: Departmental staff overview, branch broadcasts, student performance monitoring.
  - **Dean**: College-wide circulars, inter-departmental analytics, institutional governance.
- 📄 **Smart Document Hub**: Ingestion pipeline supporting PDF, DOCX, and TXT files with background chunking and vector indexing.
- 📅 **Academic Calendar**: Visual schedule for classes, exams, submission deadlines, and university events.
- 📝 **Rich Markdown Notes & Tasks**: Personal notes editor with formatting tools and a task tracker.
- 📢 **College Notice Board**: Real-time broadcasts filtered by college, department, and target audience.

---

## 🔒 Data Isolation & Security Model

Data access strictly enforces tenant and user isolation:

```text
Private Data   ──► Isolated by user_id
College Data   ──► Isolated by college_id
```

- **Allowed**: Current user's private documents + User's college shared documents.
- **Blocked**: Documents from other colleges or other users' private workspaces.
- Filtering is enforced on both the Spring Boot API layer and the FastAPI vector retrieval queries.

---

## 📁 Project Structure

```text
AIWorkPlace/
├── docs/                   # Architectural diagrams and design specifications
│   └── architecture/       # HLD, LLD, and Database design diagrams
├── src/                    # Frontend source code (React 19 + Tailwind)
│   ├── api/                # Centralized API client & JWT token management
│   ├── components/         # Reusable UI components & modals
│   ├── context/            # Auth and application state contexts
│   ├── layouts/            # Dashboard layout and navigation sidebars
│   └── pages/              # Role pages (Dashboard, AIChat, Dean, Hod, etc.)
├── backend/                # Spring Boot REST API
│   ├── src/main/java/      # Controllers, Services, Entities, Repositories, Security
│   ├── src/main/resources/ # application.properties configuration
│   └── pom.xml             # Maven dependencies
├── rag-service/            # FastAPI Python RAG microservice
│   ├── main.py              # Parsing, embeddings, hybrid retrieval, reranking, generation
│   ├── reindex_documents.py # Re-embed stored documents after model/chunking changes
│   ├── evaluate_retrieval.py# Retrieval metrics + latency evaluation
│   ├── tests/               # RAG regression tests
│   └── requirements.txt     # Python dependencies
├── start-backend.sh        # One-click starter script for Spring Boot backend
├── start-rag.sh            # One-click starter script for FastAPI RAG service
├── package.json            # Node.js dependencies & scripts
└── vite.config.js          # Vite configuration
```

---

## 🚀 Getting Started

### 📋 Prerequisites

- **Node.js** (v18+) & **npm**
- **Java Development Kit (JDK 21)**
- **Maven** (v3.8+)
- **Python** (v3.10+)
- **PostgreSQL** (v14+ with `pgvector` extension)
- **Ollama** (for local LLM generation; model is configured in .env)

---

### 1. Database Setup

```sql
CREATE DATABASE ai_workspace;
\c ai_workspace
CREATE EXTENSION IF NOT EXISTS vector;
```

Set database credentials in the repository-root .env file (the starter scripts load it):
```properties
DB_URL=jdbc:postgresql://localhost:5432/ai_workspace
DB_USER=YOUR_POSTGRES_USERNAME
DB_PASSWORD=YOUR_POSTGRES_PASSWORD
```

---

### 2. Run the AI / RAG Service (Port 8000)

Using the automated script:
```bash
chmod +x ./start-rag.sh
./start-rag.sh
```

*Manual method:*
```bash
cd rag-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

---

### 3. Run the Spring Boot Backend (Port 8080)

Using the automated script:
```bash
chmod +x ./start-backend.sh
./start-backend.sh
```

*Manual method:*
```bash
cd backend
mvn clean spring-boot:run
```

---

### 4. Run the React Frontend (Port 5173)

From the project root:
```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🔑 Environment Variables

Copy the example to the repository-root `.env` before starting services, then replace the development placeholders with your local database credentials and strong random secrets:

```bash
cp .env.example .env
```

Important settings:
- `RAG_API_KEY` must be the same in Spring Boot and FastAPI. Do not commit your real `.env` or paste the secret into source code.
- `RAG_QUERY_CLARIFICATION_ENABLED=true` enables the pre-retrieval query clarification step. Set it to `false` to remove that extra model call.
- `RAG_RELOAD=false` is the stable default; enable reload only while actively editing the Python service.
- `OCR_ENABLED=true` enables OCR support, but scanned PDFs require the Tesseract executable and the relevant language packs.
- `OLLAMA_MODEL` must match a model installed locally in Ollama. The example uses `qwen3.5:9b-q4_K_M`; pull that exact tag, or change the value to a model you already have.

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8080` | Spring Boot Backend Base URL |
| `VITE_RAG_URL` | `http://localhost:8000` | FastAPI RAG Service Base URL |

---

## 🧠 Production RAG: Gemini + Qdrant

The target configuration in `.env.example` uses **Gemini Embedding 2 + Qdrant dense/sparse hybrid retrieval**. PostgreSQL remains the authoritative store for user profiles, document ownership, college membership and document metadata; it is not replaced by Qdrant.

### Retrieval and indexing flow

1. **Parse and validate** PDF, scanned PDF, DOCX, PPTX, HTML, TXT, Markdown, CSV and JSON. Native parsers are preferred where reliable; Unstructured preserves element structure; Tesseract OCR is used for empty PDF pages when installed.
2. **Chunk with structure**. `chunk_text()` uses the configured local tokenizer for bounded chunks, carries Markdown/uppercase section headings into related chunks, and preserves page/slide provenance.
3. **Embed consistently**. Documents and queries use the configured Gemini model and dimension. The Gemini embedding provider validates vector count, dimensions and finite values, normalizes vectors, bounds retries and does not silently fall back to a different embedding space.
4. **Index in Qdrant**. Each point holds a named dense vector, a BM25-style sparse vector, text and versioned source/ownership metadata. New document generations are staged as pending, activated only after upload succeeds, then old active points are retired.
5. **Search and recover**. Dense and sparse candidate ranks are fused with Reciprocal Rank Fusion. Query aliases help exact-fact questions; weak searches can trigger up to two bounded rewrite attempts. A follow-up is returned only after the configured retrieval/recovery pipeline fails to find evidence.
6. **Verify permissions and evidence**. Qdrant metadata filters are checked against live PostgreSQL ownership and college membership before chunks reach the answer generator. Answers use retrieved evidence and source labels; missing evidence does not become a fabricated answer.

### Set up locally

From the repository root:

```bash
bash ./setup-rag-env.sh
```

The script creates `.env` from `.env.example` **only when a local `.env` does not already exist** and attempts to set file permissions to owner-only. It never overwrites an existing environment file. The root `.env` is ignored by Git; only the placeholder-based `.env.example` belongs in the repository.

1. Open `.env` locally and set `GEMINI_API_KEY` to your key. Also verify `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, and `RAG_API_KEY`. The same `RAG_API_KEY` must be configured for Spring Boot and FastAPI. Do not paste a real key into a committed file.
2. Start Docker Desktop and launch Qdrant:
   ```bash
   docker compose -f docker-compose.rag.yml up -d
   ```
   The local Qdrant ports bind to `127.0.0.1`; do not expose an unauthenticated local instance to the public internet.
3. Install the Python dependencies in a virtual environment:
   ```bash
   python3 -m venv rag-service/venv
   source rag-service/venv/bin/activate
   python -m pip install --upgrade pip
   pip install -r rag-service/requirements.txt
   ```
4. Check that the source documents still exist under `backend/uploads/`. First validate parsing/chunking without calling the Gemini API:
   ```bash
   python rag-service/reindex_documents.py --dry-run
   ```
   This dry run does not modify either index or make embedding API calls. Any missing source file or unreadable document is reported; fix it before migration.
5. Reindex to the configured Qdrant collection:
   ```bash
   python rag-service/reindex_documents.py
   ```
   This requires the real `GEMINI_API_KEY` and PostgreSQL metadata connection. Each document is staged independently and reported as success/failure. Review the final summary and investigate **every** skipped or failed document. The script returns nonzero if documents were skipped or failed.
6. Start FastAPI and Spring Boot as described in Getting Started. Check `http://127.0.0.1:8000/health`; confirm the reported `vector_store`, collection name, embedding model and dimension. Upload a new test document and verify retrieval/scope behavior before relying on the new index.

### Important configuration

| Variable | Purpose |
| --- | --- |
| `RAG_VECTOR_BACKEND=qdrant` | Selects the new retrieval backend. Set `pgvector` only for legacy rollback. |
| `GEMINI_API_KEY` | Local-only Google Gen AI key; never commit it. |
| `EMBEDDING_MODEL_NAME=gemini-embedding-2` | Embedding model. `gemini-embedding-001` can be evaluated with a separate collection. |
| `EMBEDDING_DIMENSION=768` | Dense vector dimension for this collection. Use a new collection and full re-index when changing model or dimension. |
| `QDRANT_URL` | Local Qdrant URL, default `http://localhost:6333`. |
| `QDRANT_COLLECTION_NAME` | Versioned collection used for this model/dimension. |
| `QDRANT_SPARSE_MODEL=Qdrant/bm25` | FastEmbed sparse lexical retrieval model. Its English-oriented stemming means Hindi/Hinglish ranking quality must be measured, not assumed; Gemini dense retrieval and query aliases complement it. |
| `CHUNK_SIZE_TOKENS` / `CHUNK_OVERLAP_TOKENS` | Starting defaults 450/60. Tune only against a labelled project dataset. |
| `RAG_CANDIDATE_K=30` | Candidate pool before relevance filtering/reranking. |
| `QDRANT_MIN_DENSE_SCORE=0.35` | Initial score gate. Calibrate on real relevant and irrelevant examples; this is not a universal threshold. |
| `RERANK_ENABLED=false` | Optional local cross-encoder reranking; enable only after checking Hindi/Hinglish quality and Mac memory/latency. |
| `OCR_ENABLED=true`, `OCR_LANG=eng` | Scanned-PDF OCR. On macOS install Tesseract and its language packs; use `eng+hin` only if both are installed. |

### Migration safety

- The legacy pgvector path remains available via `RAG_VECTOR_BACKEND=pgvector`, but its `vector(384)` schema is only compatible with the legacy E5 model. Never write Gemini vectors into that schema.
- Qdrant collection names include model/dimension by default. Collection schema is checked on startup. If you change the model or output dimension, use a new collection and re-embed every document.
- The original PostgreSQL document rows and files are not deleted by this migration. Do not drop the old pgvector table/index until you have compared retrieval results and verified document coverage.
- The re-index script reads from `backend/uploads/` (override with `--upload-dir` if your actual upload location differs). It cannot recover source files that are missing from disk.
- Qdrant uses payload metadata for candidate filtering, then the FastAPI service checks linked document permissions against live PostgreSQL before using any retrieved text. Keep the RAG service key private and do not expose it directly in the frontend.

### Regression tests

```bash
cd rag-service
python -m pip install -r requirements.txt
python -m py_compile main.py vector_store.py document_parser.py reindex_documents.py evaluate_retrieval.py
pytest -q
```

GitHub Actions runs the lightweight regression suite. API/network, Qdrant, OCR and answer-level tests still require integration runs with local services and actual credentials.

### Retrieval evaluation

Create a manually verified JSONL file with real user IDs and relevant chunk IDs/UUIDs. For example:

```json
{"question":"What is my mobile number?","user_id":12,"scope":"Personal Only","relevant_chunk_ids":["qdrant-point-uuid-from-your-index"]}
{"question":"Exam date kya hai?","user_id":12,"scope":"College Only","relevant_chunk_ids":["another-point-uuid"]}
```

Run the evaluator after the service dependencies and database are ready:

```bash
python rag-service/evaluate_retrieval.py rag-service/evaluation/questions.jsonl --output rag-service/evaluation/latest-report.json
```

The evaluator uses the same retrieval-recovery path and reports Recall@5, Recall@10, MRR@10, nDCG@5, and retrieval latency p50/p95. Use the same labelled dataset for the old/new comparison. These are retrieval metrics only; separately review answer correctness, citation entailment, unsupported-answer rate, exact-fact extraction, tenant isolation, and full response latency. Do not claim accuracy improvements until those measurements demonstrate them.

## 📜 License

This project is licensed under the MIT License.
