<div align="center">

# 🎓 Kudos — AI-Powered Study Platform

**Your all-in-one study companion powered by Google Gemini**

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Storage-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-AI-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

**Upload PDFs → Generate flashcards & quizzes with AI → Study smarter, not harder**

[Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Architecture](#-architecture) · [API Reference](#-api-reference)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📚 Smart Library
- Organize study materials into **subject folders**
- Upload **PDF** lecture notes & textbooks
- Automatic **text extraction** from PDFs
- Search and filter subjects

</td>
<td width="50%">

### 🧠 AI Study Tools
- **Quiz Generator** — 15 MCQs from any PDF
- **Flashcard Generator** — 15 flip-cards with hints
- **Document Q&A** — Ask questions about your PDFs
- **Kudos AI Chatbot** — General study assistant

</td>
</tr>
<tr>
<td width="50%">

### ✅ Task Manager
- Create tasks with **priorities** & **categories**
- Set **due dates** with overdue detection
- Filter by priority, category, or status
- Sort by date, priority, or creation time
- Track completion progress

</td>
<td width="50%">

### ⏱️ Pomodoro Timer
- **Floating timer** persists across all pages
- Preset durations (5–60 min) + custom input
- Pause, resume, reset controls
- **Browser notifications** on completion
- Minimizable widget

</td>
</tr>
<tr>
<td width="50%">

### 👤 Account & Security
- Email/password authentication
- Change username & password
- Re-authentication for security
- Per-user data isolation

</td>
<td width="50%">

### 📊 Dashboard
- Overview stats (subjects, files, tasks)
- Pending tasks at a glance
- Quick action shortcuts
- Daily study tips
- Integrated Pomodoro timer control

</td>
</tr>
</table>

---

## 🛠 Tech Stack

<table>
<tr>
<td align="center" width="96">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" width="48" height="48" alt="React" />
<br><strong>React 19</strong>
</td>
<td align="center" width="96">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vitejs/vitejs-original.svg" width="48" height="48" alt="Vite" />
<br><strong>Vite</strong>
</td>
<td align="center" width="96">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firebase/firebase-plain.svg" width="48" height="48" alt="Firebase" />
<br><strong>Firebase</strong>
</td>
<td align="center" width="96">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg" width="48" height="48" alt="FastAPI" />
<br><strong>FastAPI</strong>
</td>
<td align="center" width="96">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" width="48" height="48" alt="Python" />
<br><strong>Python</strong>
</td>
<td align="center" width="96">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg" width="48" height="48" alt="Gemini" />
<br><strong>Gemini AI</strong>
</td>
</tr>
</table>

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Frontend** | React 19 + Vite 7 | Single-page application |
| **Routing** | React Router DOM 7 | Client-side navigation |
| **Auth** | Firebase Authentication | Email/password login |
| **Database** | Cloud Firestore | NoSQL document storage |
| **Storage** | Firebase Storage | PDF file storage |
| **Backend** | FastAPI + Uvicorn | REST API server |
| **AI** | Google Gemini API | Quiz, flashcard & chat generation |
| **PDF** | PyMuPDF (fitz) | Server-side text extraction |
| **Icons** | Lucide React | Modern icon library |
| **Markdown** | react-markdown + remark-gfm | Study notes rendering |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.9+
- A **Firebase** project ([create one here](https://console.firebase.google.com/))
- A **Gemini API key** ([get one here](https://aistudio.google.com/apikey))

### 1️⃣ Clone the repo

```bash
git clone https://github.com/dazzulblaster/Kudos.git
cd Kudos
```

### 2️⃣ Set up the Backend

```bash
cd backend

# Create a virtual environment (optional but recommended)
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Create environment file
echo GEMINI_API_KEY=your_gemini_api_key_here > .env

# Start the server
py -m uvicorn main:app --reload
```

> 🟢 Backend runs at **http://localhost:8000**

### 3️⃣ Set up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

> 🟢 Frontend runs at **http://localhost:5173**

### 4️⃣ Firebase Configuration

Update `frontend/src/firebase.js` with your own Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│               React Frontend  (port 5173)                   │
│                                                             │
│  Pages: Dashboard, Library, FileView, Tasks,                │
│         Chatbot, Account                                    │
│  State: useState + TimerContext (global Pomodoro timer)      │
│  Auth : Firebase Auth SDK (client-side)                     │
│  DB   : Firestore SDK (browser ↔ cloud)                     │
└──────────┬──────────────────────────────┬───────────────────┘
           │ REST API (JSON)              │ Firebase SDK
           ▼                              ▼
┌──────────────────────┐    ┌─────────────────────────────────┐
│  FastAPI Backend     │    │  Firebase (Google Cloud)         │
│  (port 8000)         │    │                                 │
│                      │    │  • Auth     — user identity      │
│  Stateless — no DB   │    │  • Firestore — structured data   │
│  • PDF text extract  │    │  • Storage  — PDF binary files   │
│  • Gemini AI calls   │    └─────────────────────────────────┘
└──────────┬───────────┘
           │ google-genai SDK
           ▼
┌──────────────────────┐
│  Google Gemini AI    │
│  • gemini-2.5-flash  │
│  • gemini-flash      │
│  • gemini-flash-lite │
└──────────────────────┘
```

> **Key design:** The backend is **stateless** — it only extracts PDF text and calls Gemini. All persistent data lives in Firebase.

---

## 📡 API Reference

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/` | Health check |
| `POST` | `/chat` | General AI study chat |
| `POST` | `/extract-text` | Extract text from uploaded PDF |
| `POST` | `/file-chat` | RAG chat grounded in PDF content |
| `POST` | `/generate-quiz` | Generate 15 MCQs from document |
| `POST` | `/generate-flashcards` | Generate 15 flashcards from document |

<details>
<summary><strong>📋 Gemini Model Fallback Strategy</strong></summary>

The backend uses automatic failover when models are overloaded (503):

**Chat requests** (quality-first):
1. `gemini-2.5-flash` → 2. `gemini-flash-latest` → 3. `gemini-2.5-flash-lite`

**JSON generation** (availability-first):
1. `gemini-2.5-flash-lite` → 2. `gemini-flash-latest` → 3. `gemini-2.5-flash`

</details>

---

## 📁 Project Structure

```
Kudos/
├── 📂 frontend/                    # React application
│   ├── index.html                  # Entry HTML
│   ├── package.json                # Dependencies
│   ├── vite.config.js              # Vite configuration
│   └── 📂 src/
│       ├── App.jsx                 # Router + auth guards
│       ├── firebase.js             # Firebase SDK init
│       ├── App.css / index.css     # Global styles
│       ├── 📂 components/          # Sidebar, FloatingTimer
│       ├── 📂 context/             # TimerContext (Pomodoro)
│       └── 📂 pages/               # All page components
│           ├── Dashboard.jsx       # Stats, overview, timer
│           ├── Library.jsx         # Subject folders
│           ├── SubjectDetail.jsx   # Files within a subject
│           ├── FileView.jsx        # Study/Flashcard/Quiz tabs
│           ├── Tasks.jsx           # Task manager
│           ├── Chatbot.jsx         # AI chat
│           └── Account.jsx         # Profile management
│
└── 📂 backend/                     # FastAPI application
    ├── main.py                     # All routes & logic
    ├── requirements.txt            # Python dependencies
    └── .env                        # GEMINI_API_KEY (not in git)
```

---

## 🗄️ Database Schema

<details>
<summary><strong>Firestore Collections</strong> (click to expand)</summary>

| Collection | Key Fields | Description |
|:-----------|:-----------|:------------|
| `users` | `uid`, `username`, `email`, `createdAt` | User profiles |
| `subjects` | `uid`, `name`, `description`, `createdAt` | Subject folders |
| `files` | `uid`, `subjectId`, `name`, `downloadURL`, `extractedText` | Uploaded PDFs |
| `tasks` | `uid`, `title`, `dueDate`, `priority`, `category`, `completed` | Tasks |
| `flashcards` | `uid`, `fileId`, `cards[]` | Generated flashcard decks |
| `quizzes` | `uid`, `fileId`, `questions[]` | Generated quiz sets |

</details>

---

<div align="center">

## 👨‍💻 Author

**Izzul Danish**

Built as a Final Year Project (FYP) — an AI-powered study platform for university students.

---

Made with ❤️ using React, FastAPI, Firebase & Google Gemini

</div>
