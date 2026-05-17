from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv
import os, json, re, time, tempfile, fitz  # fitz = PyMuPDF

load_dotenv()




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


