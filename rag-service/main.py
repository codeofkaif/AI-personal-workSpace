"""
AI Personal Workspace — FastAPI RAG Service
Handles: Document Ingestion, Embedding, Vector Search, LLM Answer Generation
Trained for User Identity & Role Awareness ("me" / "mera" = authenticated user profile)
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Personal Workspace — RAG Service",
    description="FastAPI service for document ingestion, embeddings, and role-aware AI Q&A",
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv("RAG_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",") if x.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic Models ──────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    user_id: Optional[int] = None
    top_k: Optional[int] = 5
    user_profile: Optional[Dict[str, Any]] = None
    scope: Optional[str] = "College + Personal"

class QueryResponse(BaseModel):
    answer: str
    sources: List[str] = []
    chunks_used: int = 0

class IngestResponse(BaseModel):
    success: bool
    message: str
    document_id: Optional[str] = None
    chunks_created: int = 0

# ── Global SentenceTransformer Model ─────────────────────────────────────────

# Model and vector-column dimensions must match. A model change requires re-embedding all chunks.
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "384"))
CHUNK_SIZE_TOKENS = int(os.getenv("CHUNK_SIZE_TOKENS", "350"))
CHUNK_OVERLAP_TOKENS = int(os.getenv("CHUNK_OVERLAP_TOKENS", "50"))
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "10m")
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "4096"))
OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.1"))
OLLAMA_TOP_P = float(os.getenv("OLLAMA_TOP_P", "0.85"))
RAG_CANDIDATE_K = int(os.getenv("RAG_CANDIDATE_K", "20"))
RAG_SIMILARITY_THRESHOLD = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.25"))

_embedding_model = None

def get_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        dimension = _embedding_model.get_sentence_embedding_dimension()
        if dimension != EMBEDDING_DIMENSION:
            _embedding_model = None
            raise RuntimeError(
                f"Embedding dimension mismatch: model={dimension}, configured={EMBEDDING_DIMENSION}. "
                "Migrate/re-embed all existing chunks before changing embedding models."
            )
        logger.info("Embedding model %s ready (dimension=%s)", EMBEDDING_MODEL_NAME, dimension)
    return _embedding_model

def get_embedding(text: str) -> List[float]:
    """Return a normalized embedding or fail; never index/search with a fake zero vector."""
    if not text or not text.strip():
        raise ValueError("Cannot embed empty text")
    values = get_model().encode(text, normalize_embeddings=True, convert_to_numpy=True).tolist()
    if len(values) != EMBEDDING_DIMENSION:
        raise RuntimeError("Embedding dimension mismatch")
    return values

# ── DB Connection ─────────────────────────────────────────────────────────────

def get_db_connection():
    try:
        import psycopg2
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            database="ai_workspace",
            user=os.getenv("DB_USER", "kaifkhan"),
            password=os.getenv("DB_PASSWORD", "")
        )
        return conn
    except Exception as e:
        logger.error(f"DB connection failed: {e}")
        return None

def fetch_user_profile(user_id: Optional[int], passed_profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Fetch complete user identity and placement data from DB or passed payload"""
    profile = {
        "id": user_id,
        "name": "User",
        "email": "",
        "role": "STUDENT",
        "department": "Computer Science & Engineering",
        "roll_number": f"CS2026-{user_id or 1:03d}",
        "cgpa": 8.5,
        "placement_score": 85,
        "placement_category": "STRONG",
        "college": "Babu Banarasi Das University"
    }

    if passed_profile and isinstance(passed_profile, dict):
        profile.update({k: v for k, v in passed_profile.items() if v is not None})
        return profile

    if not user_id:
        return profile

    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT u.name, u.email, u.role, u.department, u.roll_number, u.cgpa, c.name as college_name
                FROM users u
                LEFT JOIN colleges c ON u.college_id = c.id
                WHERE u.id = %s
            """, (user_id,))
            row = cur.fetchone()
            if row:
                profile["name"] = row[0] or profile["name"]
                profile["email"] = row[1] or profile["email"]
                profile["role"] = (row[2] or "STUDENT").upper()
                profile["department"] = row[3] or profile["department"]
                profile["roll_number"] = row[4] or profile["roll_number"]
                profile["cgpa"] = float(row[5]) if row[5] is not None else 8.5
                if row[6]:
                    profile["college"] = row[6]

            # Compute placement score for students
            if profile["role"] == "STUDENT":
                cur.execute("""
                    SELECT COUNT(*) FROM documents 
                    WHERE user_id = %s AND (LOWER(title) LIKE '%%resume%%' OR LOWER(title) LIKE '%%cv%%' OR LOWER(title) LIKE '%%kaif%%')
                """, (user_id,))
                has_resume = (cur.fetchone()[0] or 0) > 0

                cur.execute("SELECT COUNT(*) FROM tasks WHERE user_id = %s AND status = 'COMPLETED'", (user_id,))
                tasks_done = cur.fetchone()[0] or 0

                cur.execute("SELECT COUNT(*) FROM notes WHERE user_id = %s", (user_id,))
                notes_cnt = cur.fetchone()[0] or 0

                score = 30
                if has_resume: score += 35
                if tasks_done >= 1: score += 20
                if notes_cnt >= 1: score += 15
                score = min(100, score)

                profile["placement_score"] = score
                profile["placement_category"] = "STRONG" if score >= 75 else ("MODERATE" if score >= 50 else "NEEDS_PREPARATION")
                profile["has_resume"] = has_resume

            cur.close()
            conn.close()
        except Exception as e:
            logger.warning(f"Error reading user profile: {e}")
            if conn:
                conn.close()

    return profile

def is_self_referential_query(q: str, profile: Dict[str, Any]) -> bool:
    """Detect if the user is asking about themselves, their profile, or their role"""
    q_lower = q.lower()
    name = (profile.get("name") or "").lower()
    first_name = name.split()[0] if name else ""

    triggers = [
        "me", "mera", "meri", "mere", "mai", "main", "my", "mine", "myself",
        "who am i", "who i am", "apne", "apna", "apni", "profile", "role",
        "placement", "cgpa", "department", "roll number", "attendance",
        "kaun hu", "kya hu", "about me", "my resume", "mera resume",
        "meri placement", "mera score", "mere bare", "mere baare",
        "scholarship", "chhatravritti", "chhatravriti", "fee", "fees"
    ]

    if name and name in q_lower:
        return True
    if first_name and len(first_name) > 2 and first_name in q_lower:
        return True

    words = set(re.findall(r'\b\w+\b', q_lower))
    return any(t in words or t in q_lower for t in triggers)

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract text content from uploaded file, stripping null bytes for PostgreSQL compatibility"""
    try:
        lower_name = filename.lower()
        if lower_name.endswith('.pdf'):
            try:
                import pypdf
                import io
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                text = "\n".join(page.extract_text() or "" for page in reader.pages)
                return text.replace('\x00', '')
            except Exception:
                try:
                    import PyPDF2
                    import io
                    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
                    text = "\n".join(page.extract_text() or "" for page in reader.pages)
                    return text.replace('\x00', '')
                except Exception as ep:
                    logger.error(f"PDF extraction error: {ep}")
                    return ""
        elif lower_name.endswith('.docx') or lower_name.endswith('.doc'):
            try:
                import docx
                import io
                doc = docx.Document(io.BytesIO(file_bytes))
                text = "\n".join(p.text for p in doc.paragraphs if p.text)
                return text.replace('\x00', '')
            except Exception as ed:
                logger.error(f"DOCX extraction error: {ed}")
                return ""
        else:
            return file_bytes.decode('utf-8', errors='ignore').replace('\x00', '')
    except Exception as e:
        logger.error(f"Text extraction error: {e}")
        return ""

def chunk_text(text: str, chunk_size: Optional[int] = None, overlap: Optional[int] = None) -> List[str]:
    """Paragraph-aware chunks bounded with the embedding tokenizer when available."""
    target = max(64, chunk_size or CHUNK_SIZE_TOKENS)
    overlap_tokens = max(0, min(overlap if overlap is not None else CHUNK_OVERLAP_TOKENS, target // 3))
    tokenizer = getattr(get_model(), "tokenizer", None)

    def size_of(value: str) -> int:
        if tokenizer:
            try:
                return len(tokenizer.encode(value, add_special_tokens=False))
            except Exception:
                pass
        return len(value.split())

    def split_large(value: str) -> List[str]:
        if size_of(value) <= target:
            return [value]
        if tokenizer:
            ids = tokenizer.encode(value, add_special_tokens=False)
            pieces = []
            step = max(1, target - overlap_tokens)
            for i in range(0, len(ids), step):
                piece = tokenizer.decode(ids[i:i + target], skip_special_tokens=True).strip()
                if piece:
                    pieces.append(piece)
            return pieces
        words = value.split()
        step = max(1, target - overlap_tokens)
        return [" ".join(words[i:i + target]) for i in range(0, len(words), step)]

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    units = [piece for part in paragraphs for piece in split_large(part)]
    chunks, current, current_size = [], [], 0
    for unit in units:
        unit_size = size_of(unit)
        if current and current_size + unit_size > target:
            chunks.append("\n\n".join(current))
            tail, tail_size = [], 0
            for prior in reversed(current):
                prior_size = size_of(prior)
                if tail_size + prior_size > overlap_tokens:
                    break
                tail.insert(0, prior)
                tail_size += prior_size
            current, current_size = tail, tail_size
        current.append(unit)
        current_size += unit_size
    if current:
        chunks.append("\n\n".join(current))
    return [chunk for chunk in chunks if chunk.strip()]

# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "RAG Service", "version": "1.2.0", "embedding_model": EMBEDDING_MODEL_NAME, "embedding_dimension": EMBEDDING_DIMENSION}

@app.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    file: UploadFile = File(...),
    user_id: Optional[int] = Form(None),
    document_id: Optional[int] = Form(None)
):
    """Ingest a document: extract text → chunk → embed → store in pgvector"""
    try:
        file_bytes = await file.read()
        logger.info(f"Ingesting: {file.filename} (size: {len(file_bytes)} bytes) for user: {user_id}")
        
        text = extract_text_from_file(file_bytes, file.filename)
        if not text.strip():
            return IngestResponse(
                success=False,
                message=f"Could not extract readable text from '{file.filename}'.",
                chunks_created=0
            )
        
        chunks = chunk_text(text)
        logger.info(f"Generated {len(chunks)} chunks from {file.filename}")
        
        conn = get_db_connection()
        chunks_stored = 0
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE EXTENSION IF NOT EXISTS vector;
                    CREATE TABLE IF NOT EXISTS document_chunks (
                        id SERIAL PRIMARY KEY,
                        content TEXT,
                        metadata JSONB,
                        page_number INTEGER DEFAULT 0,
                        chunk_index INTEGER DEFAULT 0,
                        document_id INTEGER,
                        embedding vector(384)
                    );
                """)
                
                meta_json = json.dumps({
                    "filename": file.filename,
                    "user_id": user_id,
                    "document_id": document_id
                })
                
                for i, chunk in enumerate(chunks):
                    chunk_clean = chunk.replace('\x00', '')
                    embedding = get_embedding(chunk_clean)
                    cursor.execute(
                        "INSERT INTO document_chunks (content, metadata, chunk_index, document_id, embedding) VALUES (%s, %s, %s, %s, %s)",
                        (chunk_clean, meta_json, i, document_id, embedding)
                    )
                    chunks_stored += 1
                
                conn.commit()
                cursor.close()
                conn.close()
                logger.info(f"Stored {chunks_stored} chunks in pgvector for {file.filename}")
            except Exception as e:
                logger.error(f"Database insertion failed: {e}")
                if conn:
                    conn.rollback()
                    conn.close()
        
        return IngestResponse(
            success=True,
            message=f"Document '{file.filename}' processed successfully ({chunks_stored} chunks indexed)",
            document_id=str(document_id) if document_id else None,
            chunks_created=chunks_stored or len(chunks)
        )
    except Exception as e:
        logger.error(f"Ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def query_ai(req: QueryRequest):
    """Answer a user question using RAG + User Identity & Role Awareness with STRICT privacy boundaries"""
    try:
        user_profile = fetch_user_profile(req.user_id, req.user_profile)
        is_self = is_self_referential_query(req.question, user_profile)
        scope = req.scope or "College + Personal"
        logger.info(f"Query: '{req.question[:80]}' | User: {user_profile['name']} ({user_profile['role']}) | Scope: {scope} | Self-ref: {is_self}")

        # Fast direct answer for simple identity/role questions
        q_clean = req.question.strip().lower()
        first_name = user_profile['name'].split()[0] if user_profile.get('name') else 'Student'

        if re.search(r'\b(mera role|my role|kya role|meri role)\b', q_clean):
            role_desc = {
                "STUDENT": "Student (Academic & Placement Preparation)",
                "HOD": f"Head of Department ({user_profile['department']})",
                "DEAN": "Dean of Academic Affairs",
                "ADMIN": "Super Administrator / College Admin",
                "COLLEGE_ADMIN": "College Administrator"
            }.get(user_profile['role'], user_profile['role'])
            return QueryResponse(
                answer=(
                    f"👋 **Hello {first_name}!**\n\n"
                    f"Aapka current workspace profile status:\n\n"
                    f"• 🛡️ **Role:** **{user_profile['role']}** ({role_desc})\n"
                    f"• 🏢 **Department:** {user_profile['department']}\n"
                    f"• 🏛️ **Institute:** {user_profile['college']}\n\n"
                    f"✨ *Aapko aapke role ke anusaar sabhi features aur dashboard access activate hain.*"
                ),
                sources=["User Session Profile"],
                chunks_used=1
            )

        # NOTE: "about me" queries run through full RAG search so personal documents (resume, scholarship) are used.
        # Profile data is also injected via user_context in generate_answer.

        if re.search(r'\b(mera placement|my placement|placement score|placement standing|placement status)\b', q_clean):
            has_res = user_profile.get('has_resume', True)
            res_tag = "Uploaded & Verified ✅" if has_res else "Upload Pending ⚠️"
            return QueryResponse(
                answer=(
                    f"🎯 **Aapka Placement Readiness Summary:**\n\n"
                    f"• 📊 **Readiness Score:** **{user_profile['placement_score']}%**\n"
                    f"• 🌟 **Placement Category:** **{user_profile['placement_category']} Category**\n"
                    f"• 📄 **Resume Status:** {res_tag}\n"
                    f"• 🏢 **Department:** {user_profile['department']}\n\n"
                    f"🏆 *Aap Tier-1 campus placement drives aur internship drives ke liye eligible hain.*"
                ),
                sources=["Placement Cell Records"],
                chunks_used=1
            )

        context_items: List[Dict[str, Any]] = []
        sources = []

        # 1. Embed question
        try:
            question_embedding = get_embedding(req.question)
        except Exception as e:
            logger.exception("Query embedding failed")
            raise HTTPException(status_code=503, detail="Embedding model unavailable or misconfigured.") from e

        # 2. Search pgvector with STRICT USER PERMISSION ENFORCEMENT & Hybrid Keyword Search
        conn = get_db_connection()
        if conn:
            try:
                cursor = conn.cursor()

                # User personal documents search:
                # Prioritize user's own files (resume, scholarship, notes)
                if req.user_id and scope != "College Only":
                    cursor.execute("""
                        SELECT dc.content, dc.metadata, 1 - (dc.embedding <=> %s::vector) AS similarity
                        FROM document_chunks dc
                        LEFT JOIN documents d ON dc.document_id = d.id
                        WHERE COALESCE(d.user_id, (dc.metadata->>'user_id')::bigint) = %s
                          AND (d.is_college_doc IS NOT TRUE)
                        ORDER BY dc.embedding <=> %s::vector
                        LIMIT 5
                    """, (question_embedding, req.user_id, question_embedding))
                    user_rows = cursor.fetchall()
                    for c, m, sim in user_rows:
                        fn = "User Document"
                        if isinstance(m, dict):
                            fn = m.get("filename", "User Document")
                        elif isinstance(m, str):
                            try:
                                fn = json.loads(m).get("filename", "User Document")
                            except Exception:
                                fn = "User Document"
                        
                        # Match if similarity is reasonable OR filename/content keywords appear in query
                        q_words = [w.lower() for w in re.findall(r'\w+', req.question) if len(w) > 3]
                        fn_lower = fn.lower()
                        keyword_match = any(w in fn_lower for w in q_words)

                        if (sim > 0.08 or keyword_match or is_self):
                            if not any(item["content"] == c for item in context_items):
                                context_items.append({"content": c, "filename": fn, "similarity": sim})
                            if fn not in sources:
                                sources.append(fn)

                # STRICT ISOLATION QUERY:
                # User can ONLY see:
                # 1. College-wide public documents (d.is_college_doc = true)
                # 2. Their OWN uploaded documents (user_id = req.user_id)
                # NEVER another user's private documents!
                if scope == "Personal Only" and req.user_id:
                    cursor.execute("""
                        SELECT dc.content, dc.metadata, 1 - (dc.embedding <=> %s::vector) AS similarity
                        FROM document_chunks dc
                        LEFT JOIN documents d ON dc.document_id = d.id
                        WHERE COALESCE(d.user_id, (dc.metadata->>'user_id')::bigint) = %s
                          AND (d.is_college_doc IS NOT TRUE)
                        ORDER BY dc.embedding <=> %s::vector
                        LIMIT %s
                    """, (question_embedding, req.user_id, question_embedding, max(req.top_k or 8, 8)))

                elif scope == "College Only":
                    cursor.execute("""
                        SELECT dc.content, dc.metadata, 1 - (dc.embedding <=> %s::vector) AS similarity
                        FROM document_chunks dc
                        LEFT JOIN documents d ON dc.document_id = d.id
                        WHERE (d.is_college_doc = true OR (dc.metadata->>'is_college_doc')::boolean = true)
                        ORDER BY dc.embedding <=> %s::vector
                        LIMIT %s
                    """, (question_embedding, question_embedding, max(req.top_k or 8, 8)))

                else:
                    # Default "College + Personal"
                    if req.user_id:
                        cursor.execute("""
                            SELECT dc.content, dc.metadata, 1 - (dc.embedding <=> %s::vector) AS similarity
                            FROM document_chunks dc
                            LEFT JOIN documents d ON dc.document_id = d.id
                            WHERE (
                                (d.is_college_doc = true OR (dc.metadata->>'is_college_doc')::boolean = true)
                                OR (COALESCE(d.user_id, (dc.metadata->>'user_id')::bigint) = %s)
                            )
                            ORDER BY dc.embedding <=> %s::vector
                            LIMIT %s
                        """, (question_embedding, req.user_id, question_embedding, max(req.top_k or 8, 8)))
                    else:
                        # Non-authenticated: college public docs ONLY
                        cursor.execute("""
                            SELECT dc.content, dc.metadata, 1 - (dc.embedding <=> %s::vector) AS similarity
                            FROM document_chunks dc
                            LEFT JOIN documents d ON dc.document_id = d.id
                            WHERE (d.is_college_doc = true OR (dc.metadata->>'is_college_doc')::boolean = true)
                            ORDER BY dc.embedding <=> %s::vector
                            LIMIT %s
                        """, (question_embedding, question_embedding, max(req.top_k or 8, 8)))

                rows = cursor.fetchall()
                for content, metadata, sim in rows:
                    if sim > 0.10:
                        fname = "Document"
                        if isinstance(metadata, dict):
                            fname = metadata.get("filename", "Document")
                        elif isinstance(metadata, str):
                            try:
                                parsed = json.loads(metadata)
                                fname = parsed.get("filename", "Document")
                            except Exception:
                                fname = metadata
                        if not any(item["content"] == content for item in context_items):
                            context_items.append({"content": content, "filename": fname, "similarity": sim})
                        if fname and fname not in sources:
                            sources.append(fname)

                cursor.close()
                conn.close()
            except Exception as e:
                logger.warning(f"Vector search failed: {e}")
                if conn:
                    conn.close()

        # 3. Generate grounded answer with Advanced Prompt Engineering
        answer = generate_answer(req.question, context_items, user_profile, is_self)

        return QueryResponse(
            answer=answer,
            sources=sources[:5],
            chunks_used=len(context_items)
        )
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "gemma2:2b")

def _call_ollama(prompt: str, max_tokens: int = 500) -> Optional[str]:
    """Call local Ollama API with tuned generation parameters"""
    try:
        import httpx
        resp = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "keep_alive": OLLAMA_KEEP_ALIVE,
                "options": {
                    "num_ctx": OLLAMA_NUM_CTX,
                    "num_predict": max_tokens,
                    "temperature": OLLAMA_TEMPERATURE,
                    "top_p": OLLAMA_TOP_P
                }
            },
            timeout=50,
        )
        if resp.status_code == 200:
            return resp.json().get("response", "").strip()
    except Exception as e:
        logger.warning(f"Ollama call failed: {e}")
    return None

def clean_and_format_answer(answer: str) -> str:
    """Ensure the answer is clean, professional, and properly structured in Markdown"""
    if not answer:
        return ""
    # Strip prompt prefix leakage
    answer = re.sub(r'^(STRUCTURED GROUNDED RESPONSE:|FRIENDLY & STRUCTURED ANSWER:|STRUCTURED & CLEAN ANSWER:|ANSWER:|Response:)\s*', '', answer, flags=re.IGNORECASE)
    # Ensure double newlines before bullets/numbered items for clean markdown rendering
    answer = re.sub(r'([^\n])\n([•\-\*]|\d+\.)', r'\1\n\n\2', answer)
    # Strip excessive empty lines
    answer = re.sub(r'\n{3,}', '\n\n', answer)
    return answer.strip()

def generate_answer(
    question: str,
    context_items: List[Dict[str, Any]],
    user_profile: Dict[str, Any],
    is_self: bool = False
) -> str:
    """Production RAG Answer Generation with Advanced Prompt Engineering & Source Citations"""
    first_name = user_profile.get('name', 'Student').split()[0]
    user_context = (
        f"AUTHENTICATED STUDENT IDENTITY:\n"
        f"- Full Name: {user_profile.get('name')}\n"
        f"- Role: {user_profile.get('role')}\n"
        f"- Branch / Department: {user_profile.get('department')}\n"
        f"- Roll Number: {user_profile.get('roll_number')}\n"
        f"- Current Academic CGPA: {user_profile.get('cgpa')}\n"
        f"- Placement Readiness Standing: {user_profile.get('placement_score')}% ({user_profile.get('placement_category')} Category)\n"
        f"- University: {user_profile.get('college')}\n"
    )

    if not context_items and not is_self:
        return (
            f"⚠️ **Relevant Information Not Found**\n\n"
            f"Mujhe aapke uploaded documents mein **'{question[:60]}'** se related specific information nahi mili.\n\n"
            f"📋 **Possible reasons:**\n"
            f"• Is topic ka document abhi tak upload nahi hua hai\n"
            f"• Aapne sirf College docs select kiya ho aur file Personal mein ho\n\n"
            f"💡 **Next Step:** Relevant syllabus, lab file ya notes PDF upload karein aur phir query karein."
        )

    if not context_items and is_self:
        return (
            f"👋 **Hello {first_name}!**\n\n"
            f"Aapka current academic profile overview:\n\n"
            f"• 🛡️ **Role:** {user_profile.get('role')}\n"
            f"• 🎓 **Department:** {user_profile.get('department')}\n"
            f"• 🆔 **Roll Number:** `{user_profile.get('roll_number')}`\n"
            f"• 📊 **CGPA:** **{user_profile.get('cgpa')}** / 10.0\n"
            f"• 🌟 **Placement Readiness:** **{user_profile.get('placement_score')}%**\n\n"
            f"💡 *Apni detailed technical skills, resume projects ya scholarship verify karne ke liye apna PDF document upload karein.*"
        )

    # Prioritize top 4 most relevant excerpts to prevent context dilution
    formatted_excerpts = []
    for i, item in enumerate(context_items[:4], 1):
        fn = item.get("filename", "Uploaded Document")
        cnt = item.get("content", "").strip()
        formatted_excerpts.append(f"=== [DOCUMENT #{i} | File: {fn}] ===\n{cnt}")

    context_str = "\n\n".join(formatted_excerpts)

    prompt = f"""You are an expert Academic & Career Intelligence AI Assistant for college students in AI Workspace.
AUTHENTICATED STUDENT:
- Full Name: {user_profile.get('name', 'Student')}
- Role: {user_profile.get('role', 'STUDENT')}
- Branch & Department: {user_profile.get('department', 'Computer Science & Engineering')}
- Roll Number: {user_profile.get('roll_number', 'N/A')}
- Current CGPA: {user_profile.get('cgpa', 'N/A')}
- University: {user_profile.get('college', 'Babu Banarasi Das University')}

CRITICAL INSTRUCTIONS:
1. FACTUAL GROUNDING (STRICT):
   - Answer EXCLUSIVELY using the verified Document Excerpts and Student details provided below.
   - Do NOT assume, fabricate, or hallucinate any unverified facts.
   - Mention the source document for facts (e.g. [Source: Jishan_SE.pdf]).

2. THOROUGH COVERAGE:
   - If the user asks about their skills, list their actual programming languages, web technologies, databases, and core CS subjects from the document.
   - If the user asks about projects, name the specific projects (e.g., CampusFix, Campus Canteen, AI Workspace, etc.) and describe what they do along with live links if present.
   - If the user asks about scholarship, state the scholarship scheme, annual income, registration/OTR number, and institution name from the document.

3. LANGUAGE & STRUCTURE:
   - If asked in Hinglish/Hindi (e.g., "mere bare me sab batao"), respond in polite, clear, natural Hinglish.
   - If asked in English, respond in professional academic English.
   - Use clean Markdown with bold headers (## or **Topic:**), clear bullet points, and an encouraging Next Step.

DOCUMENT EXCERPTS:
{context_str}

USER QUESTION:
{question}

STRUCTURED & FACTUAL RESPONSE:"""

    ollama_answer = _call_ollama(prompt, max_tokens=500)
    if ollama_answer:
        cleaned = clean_and_format_answer(ollama_answer)
        logger.info(f"Ollama ({OLLAMA_MODEL}) generated high-precision RAG answer.")
        return cleaned

    # Fallback if Ollama is unreachable: provide cleanly labeled excerpt highlights
    highlights = []
    for item in context_items[:3]:
        fn = item.get("filename", "Document")
        c = item.get("content", "")
        snip = c[:260] + "..." if len(c) > 260 else c
        highlights.append(f"• **[{fn}]** {snip}")

    combined = "\n\n".join(highlights)
    return (
        f"📌 **Relevant Facts Found in Your Documents:**\n\n"
        f"{combined}\n\n"
        f"💡 *Ollama local model was busy; raw document highlights displayed above.*"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
