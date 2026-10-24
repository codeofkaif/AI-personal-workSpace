# 🎓 AI Personal Workspace (Campus Copilot)

> An intelligent, role-aware, full-stack Academic Workspace & Campus Copilot powered by **React 19**, **Spring Boot 3**, and a **FastAPI RAG (Retrieval-Augmented Generation) Engine**.

---

## 🌟 Overview

**AI Personal Workspace** is an all-in-one academic and institutional workspace designed for colleges and universities. It bridges the gap between campus administration, faculty, and students by combining role-based workspaces with an AI assistant capable of answering questions from syllabi, campus notices, lecture notes, and official university circulars.

---

## ⚡ Key Features

- 🤖 **Context-Aware AI Assistant (RAG)**: Ask questions directly to your personal documents, department notices, or academic schedules. Built-in query grounding prevents hallucinations.
- 🔐 **Role-Based Access Control (RBAC)**: Custom dashboard and specialized tools for:
  - **Student**: Task planner, lecture notes editor, AI study buddy, timetable, notices.
  - **Faculty**: Student analytics, subject-wise document distribution, announcements.
  - **HOD (Head of Department)**: Departmental staff monitoring, branch notices, performance reports.
  - **Dean**: Institution-wide circulars, inter-departmental analytics, university policies.
- 📄 **Smart Document Hub**: Upload and process PDFs, DOCX, and TXT files with real-time vector embeddings and semantic search.
- 📅 **Academic Calendar & Schedule**: Organize classes, exams, submission deadlines, and campus events.
- 📝 **Rich Notes & Task Tracker**: Markdown-supported personal notes and kanban-style task tracking.
- 📢 **College Notice Board**: Real-time broadcasts filtered by department and target audience.

---

## 🏗️ Architecture & Tech Stack

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

### 💻 Technologies Used

| Tier | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Lucide React, React Router v7 |
| **Backend** | Spring Boot 3.3.5, Java 21, Spring Security (JWT), Spring Data JPA, PostgreSQL |
| **AI / RAG** | FastAPI, Python 3.10+, Sentence-Transformers (`all-MiniLM-L6-v2`), pgvector, Uvicorn |

---

## 📁 Project Structure

```text
AIWorkPlace/
├── src/                    # Frontend source code (React + Tailwind)
│   ├── api/                # Centralized API client & JWT token management
│   ├── components/         # Reusable UI components & modals
│   ├── context/            # Auth and application state contexts
│   ├── layouts/            # Dashboard layout and navigation sidebars
│   └── pages/              # Role pages (Dashboard, AIChat, Dean, Hod, etc.)
├── backend/                # Spring Boot REST API
│   ├── src/main/java/      # Controllers, Services, Repositories, Security
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

Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher) & **npm**
- **Java Development Kit (JDK 21)**
- **Maven** (v3.8+)
- **Python** (v3.10+)
- **PostgreSQL** (v14+ recommended with `pgvector` extension)
- *(Optional)* **Ollama** (for local offline LLM generation)

---

### 1. Database Setup

Create a PostgreSQL database named `ai_workspace`:

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

### 4. Run the React Frontend (Port 5173 / 3000)

From the project root:
```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser and navigate to `http://localhost:5173` (or the port displayed in your terminal).

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

This project is licensed under the MIT License - see the LICENSE file for details.
