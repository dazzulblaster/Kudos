from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv
import os, json, re, time, tempfile, fitz  # fitz = PyMuPDF

load_dotenv()

# ── Firebase Admin SDK (optional — only if serviceAccountKey.json exists) ──────
_admin_enabled = False
import sys, traceback
try:
    import firebase_admin
    from firebase_admin import credentials, auth as fb_auth, firestore as fb_fs
    _SA_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT", "serviceAccountKey.json")
    print(f"[init] Looking for service account key at: {os.path.abspath(_SA_PATH)}", file=sys.stderr, flush=True)
    print(f"[init] File exists: {os.path.exists(_SA_PATH)}", file=sys.stderr, flush=True)
    if os.path.exists(_SA_PATH):
        if not firebase_admin._apps:
            firebase_admin.initialize_app(credentials.Certificate(_SA_PATH))
            print("[init] Firebase Admin SDK initialized (fresh).", file=sys.stderr, flush=True)
        else:
            print("[init] Firebase Admin SDK already initialized (reload).", file=sys.stderr, flush=True)
        _admin_enabled = True
    else:
        print(f"[warn] {_SA_PATH} not found — admin endpoints disabled.", file=sys.stderr, flush=True)
except Exception as _e:
    print(f"[FATAL] Firebase Admin SDK error: {_e}", file=sys.stderr, flush=True)
    traceback.print_exc(file=sys.stderr)

print(f"[init] _admin_enabled = {_admin_enabled}", file=sys.stderr, flush=True)


app = FastAPI(title="Kudos Study Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Chat model chain — try best quality first, fall back on overload
MODEL_CHAIN = [
    "models/gemini-2.5-flash",
    "models/gemini-flash-latest",
    "models/gemini-2.5-flash-lite",
]

# JSON generation chain — start with the fastest/most-available lite model
JSON_MODEL_CHAIN = [
    "models/gemini-2.5-flash-lite",   # fastest, rarely overloaded
    "models/gemini-flash-latest",      # good fallback
    "models/gemini-2.5-flash",         # last resort
]

SYSTEM_PROMPT = """You are Kudos AI, a friendly and knowledgeable study assistant for students.
Your role is to help students understand academic concepts, plan their studies, summarize topics,
explain difficult ideas in simple terms, and motivate them to learn.
Be concise, clear, and encouraging. Use emojis occasionally to make the conversation friendly.
If a question is outside of academic topics, politely redirect the student back to studying."""


# ── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    user_id: str = None

class ChatResponse(BaseModel):
    response: str

class FileChat(BaseModel):
    message: str
    context: str          # extracted PDF text sent from frontend

class GenerateRequest(BaseModel):
    context: str          # extracted PDF text


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_pdf_text(file_bytes: bytes) -> str:
    """Extract plain text from PDF bytes using PyMuPDF."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    try:
        doc = fitz.open(tmp_path)
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
    finally:
        os.unlink(tmp_path)
    return text.strip()


def extract_json_array(text: str) -> list:
    """Robustly extract a JSON array from LLM output.
    Handles markdown code fences, leading/trailing text, and thinking tokens.
    """
    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    cleaned = re.sub(r'^```(?:json)?\s*', '', text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r'\s*```\s*$', '', cleaned.strip(), flags=re.MULTILINE)
    cleaned = cleaned.strip()

    # Try direct parse first
    try:
        result = json.loads(cleaned)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    # Fallback: find the first [...] block anywhere in the text
    match = re.search(r'\[[\s\S]*?\]', cleaned)
    if match:
        try:
            result = json.loads(match.group())
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    # Last resort: broader search in original text
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        return json.loads(match.group())

    raise ValueError(f"No valid JSON array found in response. Raw: {text[:300]}")


def _call_with_chain(prompt: str, chain: list) -> str:
    """Try each model in the chain. Move to next on 503 overload."""
    if not client:
        raise HTTPException(503, "Gemini API key not configured.")
    last_err = None
    for model in chain:
        try:
            r = client.models.generate_content(model=model, contents=prompt)
            return r.text
        except Exception as e:
            last_err = e
            if "503" in str(e) or "UNAVAILABLE" in str(e):
                print(f"[warn] {model} overloaded, trying next model...")
                continue          # try next model immediately
            raise                 # non-503 error — fail immediately
    raise HTTPException(503, f"All models are busy. Please try again in a moment. Last error: {last_err}")


def ai(prompt: str) -> str:
    """General chat — prefers high-quality models."""
    return _call_with_chain(prompt, MODEL_CHAIN)


def ai_json(prompt: str) -> str:
    """Structured JSON generation — prefers fast/available lite models."""
    return _call_with_chain(prompt, JSON_MODEL_CHAIN)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Kudos API is running 🚀", "version": "2.0.0"}


@app.get("/debug/admin-status")
def debug_admin_status():
    """Quick check — is the Firebase Admin SDK initialized?"""
    return {"admin_enabled": _admin_enabled, "apps_count": len(firebase_admin._apps) if _admin_enabled else 0}



@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not client:
        raise HTTPException(503, "Gemini API key not configured.")
    if not request.message.strip():
        raise HTTPException(400, "Message cannot be empty")
    try:
        full_prompt = f"{SYSTEM_PROMPT}\n\nStudent: {request.message}"
        return ChatResponse(response=ai(full_prompt))
    except Exception as e:
        raise HTTPException(500, f"AI error: {str(e)}")


@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """Upload a PDF → get back the extracted plain text."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")
    data = await file.read()
    try:
        text = extract_pdf_text(data)
    except Exception as e:
        raise HTTPException(500, f"PDF extraction failed: {e}")
    return {"text": text, "chars": len(text)}


@app.post("/file-chat", response_model=ChatResponse)
async def file_chat(request: FileChat):
    """RAG chatbot: answer questions grounded strictly in the provided file context."""
    if not client:
        raise HTTPException(503, "Gemini API key not configured.")
    if not request.message.strip():
        raise HTTPException(400, "Message cannot be empty.")

    # Limit context to ~10k chars to stay within token limits
    ctx = request.context[:10000]
    prompt = f"""You are a precise study assistant. Answer the student's question using ONLY the document excerpt below.
If the answer cannot be found in the document, say "I couldn't find that in the document."

--- DOCUMENT EXCERPT ---
{ctx}
--- END OF DOCUMENT ---

Student question: {request.message}"""
    try:
        return ChatResponse(response=ai(prompt))
    except Exception as e:
        raise HTTPException(500, f"AI error: {str(e)}")


@app.post("/generate-quiz")
async def generate_quiz(request: GenerateRequest):
    """Generate 15 MCQs with explanations from the document context."""
    if not client:
        raise HTTPException(503, "Gemini API key not configured.")
    ctx = request.context[:12000]
    prompt = f"""You are an expert quiz maker. Based ONLY on the following document, create exactly 15 multiple-choice questions.

DOCUMENT:
{ctx}

Return a valid JSON array (no markdown, no extra text) of exactly 15 objects with this exact structure:
[
  {{
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "A",
    "explanation": "..."
  }}
]

Rules:
- Options must be exactly 4 (A, B, C, D)
- "answer" must be just the letter: A, B, C, or D
- Explanations should reference the document content
- Return ONLY the JSON array, nothing else."""
    try:
        raw = ai_json(prompt)
        questions = extract_json_array(raw)
        return {"questions": questions}
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(500, f"AI returned invalid JSON. Please try again. Details: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"AI error: {str(e)}")


@app.post("/generate-flashcards")
async def generate_flashcards(request: GenerateRequest):
    """Generate a deck of flashcards with hints from the document context."""
    if not client:
        raise HTTPException(503, "Gemini API key not configured.")
    ctx = request.context[:12000]
    prompt = f"""You are an expert study card creator. Based ONLY on the following document, create exactly 15 flashcards.

DOCUMENT:
{ctx}

Return a valid JSON array (no markdown, no extra text) of objects with this exact structure:
[
  {{
    "question": "...",
    "answer": "...",
    "hint": "..."
  }}
]

Rules:
- Questions should test key concepts from the document
- Answers should be concise (1-3 sentences)
- Hints should give a small clue without revealing the answer
- Return ONLY the JSON array, nothing else."""
    try:
        raw = ai_json(prompt)
        cards = extract_json_array(raw)
        return {"cards": cards}
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(500, f"AI returned invalid JSON. Please try again. Details: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"AI error: {str(e)}")


# ── Auth helpers ──────────────────────────────────────────────────────────────

@app.get("/auth/check-admin")
async def check_admin(authorization: str = Header(None)):
    """Check if the authenticated user is in the Firestore admins collection.
    Uses the Admin SDK (server-side) so it bypasses client Firestore rules."""
    if not _admin_enabled:
        print("[check-admin] Firebase Admin SDK not enabled")
        return {"is_admin": False}
    if not authorization or not authorization.startswith("Bearer "):
        print("[check-admin] No valid Authorization header")
        return {"is_admin": False}
    try:
        decoded = fb_auth.verify_id_token(authorization[7:])
        uid = decoded["uid"]
        admin_doc = fb_fs.client().collection("admins").document(uid).get()
        print(f"[check-admin] uid={uid}, doc_exists={admin_doc.exists}")
        return {"is_admin": admin_doc.exists}
    except Exception as e:
        print(f"[check-admin] Error: {e}")
        return {"is_admin": False}


@app.get("/auth/my-uid")
async def get_my_uid(authorization: str = Header(None)):
    """Return the UID of the currently authenticated user.
    Handy for setting up the admins collection correctly."""
    if not _admin_enabled:
        return {"error": "Firebase Admin SDK not enabled"}
    if not authorization or not authorization.startswith("Bearer "):
        return {"error": "Authorization header required"}
    try:
        decoded = fb_auth.verify_id_token(authorization[7:])
        return {"uid": decoded["uid"], "email": decoded.get("email", "")}
    except Exception as e:
        return {"error": str(e)}


# ── Admin ─────────────────────────────────────────────────────────────────────

class UpdateUserRequest(BaseModel):
    username: str


async def require_admin(authorization: str = Header(None)) -> str:
    """Verify Firebase ID token and confirm the user is in the admins collection."""
    if not _admin_enabled:
        raise HTTPException(503, "Admin features not configured. Place serviceAccountKey.json in the backend folder.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authorization header required.")
    token = authorization[7:]
    try:
        decoded = fb_auth.verify_id_token(token)
        uid = decoded["uid"]
    except Exception:
        raise HTTPException(401, "Invalid or expired token.")
    admin_doc = fb_fs.client().collection("admins").document(uid).get()
    if not admin_doc.exists:
        raise HTTPException(403, "Admin access required.")
    return uid


@app.get("/admin/users")
async def admin_list_users(_admin_uid: str = Depends(require_admin)):
    """Return all users from the Firestore users collection."""
    docs = fb_fs.client().collection("users").stream()
    users = [{"id": d.id, **d.to_dict()} for d in docs]
    return {"users": users, "total": len(users)}


@app.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, _admin_uid: str = Depends(require_admin)):
    """Delete a user from Firebase Auth and Firestore."""
    if uid == _admin_uid:
        raise HTTPException(400, "Cannot delete your own admin account.")
    try:
        fb_auth.delete_user(uid)
    except Exception:
        pass  # User may already be deleted from Auth
    fb_fs.client().collection("users").document(uid).delete()
    return {"success": True}


@app.patch("/admin/users/{uid}")
async def admin_update_user(uid: str, body: UpdateUserRequest, admin_uid: str = Depends(require_admin)):
    """Update a user's display name in Firebase Auth and Firestore."""
    username = body.username.strip()
    if not username:
        raise HTTPException(400, "Username cannot be empty.")
    fb_auth.update_user(uid, display_name=username)
    fb_fs.client().collection("users").document(uid).update({"username": username})
    return {"success": True}
