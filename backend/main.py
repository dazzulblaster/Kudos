from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
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

# Chat model chain — fastest first for low latency, fall back on overload
MODEL_CHAIN = [
    "models/gemini-2.5-flash-lite",   # fastest, good for most chat
    "models/gemini-flash-latest",      # solid fallback
    "models/gemini-2.5-flash",         # best quality, but slower (thinking model)
]

# JSON generation chain — start with the fastest/most-available lite model
JSON_MODEL_CHAIN = [
    "models/gemini-2.5-flash-lite",   # fastest, rarely overloaded
    "models/gemini-flash-latest",      # good fallback
    "models/gemini-2.5-flash",         # last resort
]

SYSTEM_PROMPT = """You are Kudos AI, a friendly, knowledgeable, and well-rounded assistant built into the Kudos study platform.
Your primary expertise is helping students understand academic concepts, plan their studies, summarize topics,
explain difficult ideas in simple terms, and motivate them to learn.
However, you are happy to help with ANY question — whether it's about coding, career advice, general knowledge, daily life, or just casual conversation.
Be concise, clear, and encouraging. Use emojis occasionally to make the conversation friendly."""


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
    """General chat — prefers fast models."""
    return _call_with_chain(prompt, MODEL_CHAIN)


def ai_json(prompt: str) -> str:
    """Structured JSON generation — prefers fast/available lite models."""
    return _call_with_chain(prompt, JSON_MODEL_CHAIN)


def _stream_with_chain(prompt: str, chain: list):
    """Try each model in the chain with streaming. Yields text chunks."""
    if not client:
        raise HTTPException(503, "Gemini API key not configured.")
    last_err = None
    for model in chain:
        try:
            stream = client.models.generate_content_stream(
                model=model, contents=prompt
            )
            def _generate(s=stream):
                for chunk in s:
                    if chunk.text:
                        yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                yield "data: [DONE]\n\n"
            return _generate()
        except Exception as e:
            last_err = e
            if "503" in str(e) or "UNAVAILABLE" in str(e):
                print(f"[warn] {model} overloaded, trying next model...")
                continue
            raise
    raise HTTPException(503, f"All models are busy. Last error: {last_err}")


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


@app.post("/chat-stream")
async def chat_stream(request: ChatRequest):
    """Streaming version of /chat — returns SSE text chunks."""
    if not client:
        raise HTTPException(503, "Gemini API key not configured.")
    if not request.message.strip():
        raise HTTPException(400, "Message cannot be empty")
    full_prompt = f"{SYSTEM_PROMPT}\n\nStudent: {request.message}"
    return StreamingResponse(
        _stream_with_chain(full_prompt, MODEL_CHAIN),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
    prompt = f"""You are a helpful and precise study assistant. Use the document excerpt below as your PRIMARY source to answer the student's question.

Rules:
1. If the answer CAN be found in the document, answer based on the document content. Start naturally without any special prefix.
2. If the answer CANNOT be found in the document, you should still answer the question using your general knowledge, but you MUST begin your response with exactly this disclaimer on its own line:
   "⚠️ **Note:** This answer is based on my general knowledge, not from your uploaded document."
   Then provide the helpful answer below.
3. If the question is partially covered by the document, answer with what the document says first, then supplement with general knowledge and clearly indicate which part comes from general knowledge.

--- DOCUMENT EXCERPT ---
{ctx}
--- END OF DOCUMENT ---

Student question: {request.message}"""
    try:
        return ChatResponse(response=ai(prompt))
    except Exception as e:
        raise HTTPException(500, f"AI error: {str(e)}")


@app.post("/file-chat-stream")
async def file_chat_stream(request: FileChat):
    """Streaming version of /file-chat — returns SSE text chunks."""
    if not client:
        raise HTTPException(503, "Gemini API key not configured.")
    if not request.message.strip():
        raise HTTPException(400, "Message cannot be empty.")
    ctx = request.context[:10000]
    prompt = f"""You are a helpful and precise study assistant. Use the document excerpt below as your PRIMARY source to answer the student's question.

Rules:
1. If the answer CAN be found in the document, answer based on the document content. Start naturally without any special prefix.
2. If the answer CANNOT be found in the document, you should still answer the question using your general knowledge, but you MUST begin your response with exactly this disclaimer on its own line:
   "⚠️ **Note:** This answer is based on my general knowledge, not from your uploaded document."
   Then provide the helpful answer below.
3. If the question is partially covered by the document, answer with what the document says first, then supplement with general knowledge and clearly indicate which part comes from general knowledge.

--- DOCUMENT EXCERPT ---
{ctx}
--- END OF DOCUMENT ---

Student question: {request.message}"""
    return StreamingResponse(
        _stream_with_chain(prompt, MODEL_CHAIN),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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


