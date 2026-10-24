# 🎓 AI Personal Workspace (Campus Copilot)

> **AI-powered personal and institutional workspace for college-scoped knowledge, private user documents, productivity, and source-grounded AI assistance.**

[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Spring Boot](https://img.shields.io/badge/Backend-Spring%20Boot%203.3.5-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![FastAPI](https://img.shields.io/badge/AI%20Service-FastAPI%20%2B%20PyTorch-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20pgvector-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

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
│  Sentence-Transformers • pgvector • Ollama / Local LLM │
└────────────────────────────────────────────────────────┘
```

1. **Frontend (React 19 + Vite + Tailwind CSS)**: Intuitive, high-performance web interface tailored by role (Student, Faculty, HOD, Dean).
2. **Backend (Spring Boot 3.3.5 + Java 21)**: Enterprise-grade REST API, JWT authentication, role-based authorization, database transactions, and business logic.
3. **AI / RAG Service (FastAPI + Python 3.10+)**: Text extraction, semantic chunking, vector embeddings (`all-MiniLM-L6-v2`), pgvector similarity retrieval, and LLM answer generation with citations.
4. **Database (PostgreSQL + pgvector)**: Relational application storage combined with native vector similarity search.

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
│   ├── main.py             # Document parser, embeddings, RAG endpoints
│   └── requirements.txt    # Python dependencies
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
- *(Optional)* **Ollama** (for local offline LLM generation)

---

### 1. Database Setup

```sql
CREATE DATABASE ai_workspace;
\c ai_workspace
CREATE EXTENSION IF NOT EXISTS vector;
```

Update your database credentials in `backend/src/main/resources/application.properties` if needed:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/ai_workspace
spring.datasource.username=YOUR_POSTGRES_USERNAME
spring.datasource.password=YOUR_POSTGRES_PASSWORD
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
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
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

Copy `.env.example` to create your local frontend environment file:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8080` | Spring Boot Backend Base URL |
| `VITE_RAG_URL` | `http://localhost:8000` | FastAPI RAG Service Base URL |

---

## 📜 License

This project is licensed under the MIT License.
