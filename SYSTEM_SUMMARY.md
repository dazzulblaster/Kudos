# Kudos — Study Platform: Full System Summary

> This document is a comprehensive technical summary of the Kudos system, intended to be used as context when rewriting the Final Year Project (FYP) report.

---

## 1. Project Overview

**Kudos** is an AI-powered study platform designed to help students manage their academic workload more effectively. It combines traditional productivity tools (tasks, a Pomodoro timer) with AI-driven study features (PDF-based flashcard and quiz generation, document Q&A, and a general study chatbot). The platform targets university students who want a single, integrated environment for organising materials and studying actively.

**Key value proposition:**
- Upload lecture notes or textbooks as PDFs, and the system automatically generates flashcards and quizzes from the content.
- Chat with an AI assistant grounded in your own uploaded documents.
- Manage tasks and study sessions in the same place.

---

## 2. Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| **Frontend** | React | 19.2.0 |
| **Frontend Build** | Vite | 7.3.1 |
| **Frontend Routing** | React Router DOM | 7.13.0 |
| **Authentication** | Firebase Authentication | Email/password |
| **Database** | Firebase Firestore | NoSQL, cloud-hosted |
| **File Storage** | Firebase Storage | PDF binary storage |
| **Firebase SDK** | firebase (JS) | 12.10.0 |
| **Backend Framework** | FastAPI (Python) | Async REST API |
| **Backend Server** | Uvicorn | ASGI server |
| **AI / LLM** | Google Gemini API | gemini-2.5-flash family |
| **PDF Parsing** | PyMuPDF (fitz) | Server-side text extraction |
| **File Upload** | python-multipart | Required by FastAPI for `UploadFile` |

| **Markdown Rendering** | react-markdown + remark-gfm | Study notes, chatbot messages, and document Q&A rendering |
| **Icons** | Lucide React | 0.577.0 |

---

## 3. High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                  React Frontend  (port 5173)                  │
│                                                               │
│  Pages: Dashboard, Library, FileView, Tasks, Chatbot, Account│
│  State: useState (local) + TimerContext (global)             │
│  Auth : Firebase Auth SDK (client-side)                      │
│  DB   : Firestore SDK (direct browser ↔ cloud)               │
│  Files: Firebase Storage SDK (direct browser ↔ cloud)        │
└───────────┬───────────────────────────────┬───────────────────┘
            │ REST (fetch, JSON)            │ Firebase SDK
            ▼                              ▼
┌───────────────────────┐    ┌──────────────────────────────────┐
│  FastAPI Backend      │    │  Firebase (Google Cloud)         │
│  (port 8000)          │    │                                  │
│                       │    │  • Auth   — user identity        │
│  Stateless — no DB    │    │  • Firestore — structured data   │
│  Routes:              │    │  • Storage — PDF binary files    │
│  /chat                │    └──────────────────────────────────┘
│  /extract-text        │
│  /file-chat           │
│  /generate-quiz       │
│  /generate-flashcards │
└───────────┬───────────┘
            │ google-genai SDK
            ▼
┌───────────────────────┐
│  Google Gemini AI     │
│  (cloud API)          │
│  gemini-2.5-flash     │
│  gemini-flash-latest  │
│  gemini-2.5-flash-lite│
└───────────────────────┘
```

**Important architectural note:** The FastAPI backend is completely **stateless** — it holds no database and persists no data. Its only job is to (1) extract text from PDFs and (2) call the Gemini API and return results. All persistent storage is handled by Firebase directly from the browser.

---

## 4. Features & Modules

### 4.1 Authentication
- Email and password registration and login via **Firebase Authentication**.
- On registration, the user's display name is stored via `updateProfile`, and a user profile document is also saved to the Firestore `users` collection (containing `uid`, `username`, `email`, `createdAt`).
- Session persistence is handled automatically by the Firebase SDK.
- A custom `PrivateRoute` component in React Router wraps all protected pages and redirects unauthenticated users to `/login`.
- All Firestore queries are scoped by `uid` (the Firebase user ID), so each user only sees their own data.
- On successful login, the user is redirected to `/dashboard`.

### 4.2 Dashboard
- The landing page after login, providing an overview of the user's activity.
- Displays: total subjects, total files, active tasks count, completed tasks count.
- Shows a list of pending (incomplete) tasks.
- Includes a quick-access card for AI features.
- Hosts the **Pomodoro timer** quick-start control.

### 4.3 Library (Subject & File Management)
- Users create **Subjects** (e.g., "Data Structures", "Operating Systems") which act as folders.
- Each subject is a Firestore document in the `subjects` collection.
- Inside a subject (`SubjectDetail` page), users can upload PDF files.
- **PDF Upload flow:**
  1. User selects a PDF file.
  2. File is uploaded to **Firebase Storage** at path `files/{uid}/{subjectId}/{timestamp}_{filename}`.
  3. A `downloadURL` is obtained from Storage.
  4. The PDF bytes are sent to the FastAPI backend at `POST /extract-text`.
  5. The backend uses **PyMuPDF** to extract all text from the PDF pages.
  6. The extracted text and file metadata (`name`, `downloadURL`, `storagePath`, `extractedText`) are saved as a Firestore document in the `files` collection.
- **Note:** Deleting a subject does **not** cascade — associated files in Storage and Firestore must be deleted manually from the SubjectDetail page before deleting the subject folder.

### 4.4 FileView — Study, Flashcard, and Quiz Tabs
Once a PDF is uploaded, users access it through the **FileView** page, which has three tabs:

#### Study Tab
- Displays the PDF inline via an `<iframe>` using the Firebase Storage `downloadURL`.
- Provides a side panel for taking **study notes** in markdown format — notes are **auto-saved** to Firestore with a 1-second debounce, stored as a `studyNotes` field on the file document. Notes persist across sessions.
- Features a **Preview/Code toggle** (eye/code icon pill) to switch between editing raw markdown and viewing the rendered preview.
- Includes a **File Chat** slide-in panel — a RAG (Retrieval-Augmented Generation) chatbot that answers questions strictly based on the document's extracted text. The chat panel can be toggled open/closed via a button in the notes section.

#### Flashcard Tab
- User clicks "Generate Flashcards".
- The `extractedText` (already in Firestore) is sent to `POST /generate-flashcards`.
- The backend instructs Gemini to produce exactly **15 flashcards** as a JSON array, each with `question`, `answer`, and `hint`.
- The result is saved to the `flashcards` Firestore collection and displayed as interactive flip-cards.
- Previously generated flashcards are loaded from Firestore on subsequent visits (no regeneration needed).

#### Quiz Tab
- User clicks "Generate Quiz".
- The `extractedText` is sent to `POST /generate-quiz`.
- The backend instructs Gemini to produce exactly **15 multiple-choice questions** (4 options each) as a JSON array, each with `question`, `options`, `answer` (a single letter A–D), and `explanation`.
- The result is saved to the `quizzes` Firestore collection.
- Users answer the quiz and receive a score with per-question explanations.


### 4.5 Tasks
- A full task management system with the following fields per task:
  - `title`, `description`, `dueDate`, `priority` (High / Medium / Low), `category` (Exam / Assignment / Reading / Project / Lab / Revision / Other), `completed`.
- Supports creating, editing, marking complete/incomplete, and deleting tasks.
- Client-side filtering by priority and category.
- Client-side sorting by newest first, due date, or priority.
- Overdue detection — tasks past their due date are visually highlighted.
- Stored in the `tasks` Firestore collection scoped by `uid`.

### 4.6 General AI Chatbot
- A standalone chat interface (`Chatbot` page) where users can ask any study-related question.
- Powered by Gemini via the backend `POST /chat` endpoint.
- The backend injects a **system prompt** defining the AI persona as "Kudos AI", a friendly study assistant that redirects off-topic questions back to academics.
- Chat history is **not persisted** — conversations reset on page reload.

### 4.7 Account Management
- A dedicated Account page (`/account`) where users can:
  - View their profile card (avatar with initials, display name, email).
  - **Change username** — updates Firebase Auth `displayName` via `updateProfile` (note: this does **not** update the Firestore `users` collection).
  - **Change password** — requires re-authentication with the current password (`reauthenticateWithCredential`), then calls `updatePassword`. Validates minimum length (6 chars), password match, and prevents reusing the current password.
  - View read-only account details (email, sign-in method).
  - Log out.

### 4.8 Pomodoro Timer
- A floating, globally accessible timer widget managed by `TimerContext`.
- Can be started from the Dashboard and persists as a **floating overlay** (`FloatingTimer` component) while the user navigates to other pages.
- Supports pause, resume, reset, and stop controls.
- Displays remaining time in MM:SS format with a circular SVG progress ring.
- Preset durations: 5, 10, 15, 20, 25, 30, 45, 60 minutes, plus a custom duration input (1–180 minutes).
- Can be minimized to a compact view showing only the time.
- Sends a **browser notification** when the session completes (requests permission on first start).


---

## 5. Data Models (Firestore Collections)

All collections are in Firebase Firestore. Documents are scoped by `uid` (the authenticated user's Firebase ID).

### `users`
| Field | Type | Description |
|---|---|---|
| `uid` | string | Firebase user ID (also used as the document ID) |
| `username` | string | Display name |
| `email` | string | Email address |
| `createdAt` | Timestamp | Firestore server timestamp |


### `subjects`
| Field | Type | Description |
|---|---|---|
| `uid` | string | Owner's Firebase user ID |
| `name` | string | Subject name |
| `description` | string | Optional description |
| `createdAt` | Timestamp | Firestore server timestamp |

### `files`
| Field | Type | Description |
|---|---|---|
| `uid` | string | Owner's Firebase user ID |
| `subjectId` | string | Parent subject document ID |
| `name` | string | Original filename |
| `downloadURL` | string | Firebase Storage public URL |
| `storagePath` | string | Firebase Storage path (for deletion) |
| `extractedText` | string | Full plain text extracted from PDF |
| `studyNotes` | string | User's markdown study notes (auto-saved) |
| `uploadedAt` | Timestamp | Firestore server timestamp |


### `tasks`
| Field | Type | Description |
|---|---|---|
| `uid` | string | Owner's Firebase user ID |
| `title` | string | Task title |
| `description` | string | Optional description |
| `dueDate` | string | ISO date string |
| `priority` | string | `"high"` / `"medium"` / `"low"` |
| `category` | string | `"Exam"` / `"Assignment"` / `"Reading"` / `"Project"` / `"Lab"` / `"Revision"` / `"Other"` |
| `completed` | boolean | Completion status |
| `createdAt` | Timestamp | Firestore server timestamp |

### `flashcards`
| Field | Type | Description |
|---|---|---|
| `uid` | string | Owner's Firebase user ID |
| `fileId` | string | Parent file document ID |
| `cards` | array | Array of `{question, answer, hint}` objects |
| `savedAt` | Timestamp | Firestore server timestamp |

### `quizzes`
| Field | Type | Description |
|---|---|---|
| `uid` | string | Owner's Firebase user ID |
| `fileId` | string | Parent file document ID |
| `questions` | array | Array of `{question, options[], answer, explanation}` objects |
| `savedAt` | Timestamp | Firestore server timestamp |

---

## 6. Backend API Endpoints

Base URL: `http://localhost:8000`

| Method | Endpoint | Input | Output | Purpose |
|---|---|---|---|---|
| GET | `/` | — | `{status, version}` | Health check |
| POST | `/chat` | `{message: str, user_id?: str}` | `{response: str}` | General study AI chat |
| POST | `/extract-text` | Multipart PDF file | `{text: str, chars: int}` | Extract text from uploaded PDF |
| POST | `/file-chat` | `{message: str, context: str}` | `{response: str}` | RAG chat grounded in PDF content |
| POST | `/generate-quiz` | `{context: str}` | `{questions: [...]}` | Generate 15 MCQs from document |
| POST | `/generate-flashcards` | `{context: str}` | `{cards: [...]}` | Generate 15 flashcards from document |

**Notes:**
- `context` fields are truncated server-side to 10,000 characters (`/file-chat`) or 12,000 characters (`/generate-quiz`, `/generate-flashcards`) to stay within Gemini token limits.
- The backend uses a **fallback model chain** — if the primary Gemini model returns a 503 (overloaded), it automatically retries with the next model in the chain.

---

## 7. Data Flow Diagrams

### 7.1 User Authentication Flow
```
User fills Login form
  → Firebase Auth: signInWithEmailAndPassword(email, password)
  → Firebase returns authenticated user object + token
  → onAuthStateChanged() listener fires in App.jsx
  → React state updates: user is authenticated
  → PrivateRoute allows navigation to /dashboard
  → auth.currentUser.uid used as filter in all Firestore queries
```

### 7.2 PDF Upload & Text Extraction Flow
```
User selects PDF in SubjectDetail.jsx
  → uploadBytesResumable() → Firebase Storage
  → getDownloadURL() → downloadURL string
  → fetch("POST /extract-text", PDF file bytes) → FastAPI
      [FastAPI] fitz.open(tmp_pdf) → page.get_text() for each page
      [FastAPI] Returns {text: "...", chars: N}
  → addDoc(firestore, "files", {name, downloadURL, storagePath, extractedText, uid, subjectId, uploadedAt})
  → File appears in subject's file list
```

### 7.3 Flashcard / Quiz Generation Flow
```
User clicks "Generate Flashcards" in FileView.jsx
  → Read file.extractedText from component state (already fetched from Firestore)
  → fetch("POST /generate-flashcards", {context: extractedText})
      [FastAPI] Truncate context to 12,000 chars
      [FastAPI] Build prompt with JSON schema instructions
      [FastAPI] ai_json(prompt) → _call_with_chain(prompt, JSON_MODEL_CHAIN)
      [FastAPI] Gemini returns JSON array string
      [FastAPI] extract_json_array() strips markdown fences, parses JSON
      [FastAPI] Returns {cards: [{question, answer, hint}, ...]}
   → setDoc(firestore, "flashcards/{fileId}", {uid, fileId, cards, savedAt})
  → Cards rendered as interactive flip-cards in the UI
```

### 7.4 File Chat (RAG) Flow
```
User types question in Study tab
  → Retrieve extractedText from component state
  → fetch("POST /file-chat", {message: question, context: extractedText})
      [FastAPI] Truncate context to 10,000 chars
      [FastAPI] Inject context into prompt: "Answer using ONLY this document..."
      [FastAPI] ai(prompt) → _call_with_chain(prompt, MODEL_CHAIN)
      [FastAPI] Returns {response: "..."}
  → Response displayed in chat panel
  → (Not saved to Firestore — session only)
```


---

## 8. Frontend Routing Structure

```
/ ────────────────────────────→ redirect to /login
/login ───────────────────────→ Login page (public)
/register ────────────────────→ Register page (public)
/dashboard ───────────────────→ Dashboard (protected)
/library ─────────────────────→ Library - subject list (protected)
/library/:subjectId ──────────→ SubjectDetail - file list (protected)
/library/:subjectId/file/:fileId → FileView - Study/Flashcard/Quiz (protected)

/tasks ───────────────────────→ Task manager (protected)
/chatbot ─────────────────────→ General AI chatbot (protected)
/account ─────────────────────→ Account management (protected)
```

All protected routes are wrapped in a `PrivateRoute` component that checks `onAuthStateChanged()` and redirects to `/login` if no authenticated user is found.

---

## 9. State Management

| State | Scope | Mechanism |
|---|---|---|
| Authentication | Global (app-wide) | Firebase `onAuthStateChanged()` |
| Pomodoro timer | Global (all pages) | React Context API (`TimerContext`) |
| Page data (subjects, files, tasks) | Per-page | `useState` + `useEffect` on mount |
| Form inputs | Per-component | `useState` |
| Loading / error states | Per-component | `useState` |

There is no Redux, Zustand, or other global state management library. Each page fetches its own data independently from Firestore when it mounts.

---

## 10. AI Integration Details

### Gemini Model Strategy
The backend uses two separate model chains to balance quality and availability:

**Chat chain** (quality-first, for conversational responses):
1. `models/gemini-2.5-flash` — primary, best quality
2. `models/gemini-flash-latest` — fallback
3. `models/gemini-2.5-flash-lite` — last resort

**JSON chain** (availability-first, for structured output):
1. `models/gemini-2.5-flash-lite` — fastest, rarely overloaded
2. `models/gemini-flash-latest` — fallback
3. `models/gemini-2.5-flash` — last resort

If a model returns a `503 UNAVAILABLE` error (overloaded), the system automatically tries the next model. Any other error (e.g., invalid request, auth failure) fails immediately.

### Prompt Engineering
- **General chat:** System prompt establishes the "Kudos AI" study assistant persona. It instructs the model to be concise, encouraging, and to redirect off-topic questions.
- **File chat (RAG):** The document excerpt is injected into the prompt with explicit instructions to answer only from the provided content. If the answer is not in the document, the model is instructed to say so.
- **Flashcard / Quiz generation:** Strict JSON schema is specified in the prompt with rules (exactly 15 items, exact field names, answer must be a single letter). The `extract_json_array()` helper handles common failure modes: markdown code fences, leading/trailing text, and partial JSON.

---

## 11. File & Folder Structure

```
Kudos/
├── frontend/                        # React application
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx                 # React entry point
│       ├── App.jsx                  # Router + PrivateRoute + auth listener
│       ├── firebase.js              # Firebase SDK initialisation
│       ├── App.css                  # Global component styles
│       ├── index.css                # Base styles
│       ├── assets/
│       ├── components/
│       │   ├── Sidebar.jsx          # Navigation sidebar
│       │   ├── FloatingTimer.jsx    # Global Pomodoro timer widget
│       │   └── FloatingTimer.css    # Floating timer styles
│       ├── context/
│       │   └── TimerContext.jsx     # Global timer state (React Context)
│       └── pages/
│           ├── Login.jsx / Login.css          # Login form
│           ├── Register.jsx / Register.css    # Registration form
│           ├── Dashboard.jsx                  # Home — stats, tasks overview
│           ├── Library.jsx / Library.css      # Subject list
│           ├── SubjectDetail.jsx / SubjectDetail.css  # File list + PDF upload
│           ├── FileView.jsx / FileView.css    # Study / Flashcard / Quiz tabs

│           ├── Tasks.jsx / Tasks.css          # Task manager
│           ├── Chatbot.jsx                    # General AI chat
│           └── Account.jsx                    # Profile & password management
│
└── backend/                         # FastAPI application
    ├── main.py                      # All routes, models, and helpers
    ├── requirements.txt             # Python dependencies
    └── .env                         # GEMINI_API_KEY (not committed to git)
```

---

## 12. Known Limitations & Areas for Improvement

1. **No backend authentication on AI endpoints:** The FastAPI AI endpoints (`/chat`, `/file-chat`, `/generate-quiz`, `/generate-flashcards`) are publicly accessible. Firebase tokens are not verified for these routes, meaning anyone who discovers the API URL can call them without being logged in.

2. **No chat history persistence:** Conversations in both the general Chatbot and the File Chat reset when the page is refreshed. There is no message history saved to Firestore.

3. **Hardcoded backend URL:** The backend base URL `http://localhost:8000` is repeated in multiple component files instead of being defined once in a config or `.env` file. This makes changing the URL for deployment difficult.

4. **No rate limiting:** Backend endpoints can be called an unlimited number of times, which could lead to unexpected Gemini API quota consumption.

5. **Context length truncation:** Extracted text is cut off at 10,000–12,000 characters before being sent to Gemini. For long documents, this means only the beginning of the document is used for quiz/flashcard generation.

6. **No real-time updates:** Firestore data is fetched once on page mount. If another session creates or modifies data, the current page will not update without a manual refresh. Firestore real-time listeners (`onSnapshot`) are not used.

7. **Single-file backend:** All backend logic (routes, models, helpers) lives in one `main.py` file. As the system grows, this would benefit from being split into separate router and service modules.

8. **No subject deletion cascade:** Deleting a subject folder from the Library does not automatically delete its associated files from Firebase Storage or Firestore. Files must be deleted individually first.

