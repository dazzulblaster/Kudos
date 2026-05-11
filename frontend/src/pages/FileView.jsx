import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Sidebar from '../components/Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    ArrowLeft, MessageCircle, BookOpen, Layers, Brain,
    RotateCcw, SendHorizonal, X
} from 'lucide-react';
import './FileView.css';
import '../App.css';

const BACKEND = 'http://localhost:8000';

const TABS = [
    { id: 'Study',     label: 'Study',     Icon: BookOpen },
    { id: 'Flashcard', label: 'Flashcard', Icon: Layers },
    { id: 'Quiz',      label: 'Quiz',      Icon: Brain },
];

export default function FileView() {
    const { subjectId, fileId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [file, setFile] = useState(null);
    const [tab, setTab] = useState('Study');

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => setUser(u));
        return unsub;
    }, []);

    useEffect(() => {
        if (!user) return;
        getDoc(doc(db, 'files', fileId)).then(snap => {
            if (snap.exists()) setFile({ id: snap.id, ...snap.data() });
        });
    }, [user, fileId]);

    if (!file) return (
        <div className="app-shell">
            <Sidebar />
            <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="spin" style={{ width: 36, height: 36, borderTopColor: '#86c9a8' }} />
            </main>
        </div>
    );

    return (
        <div className="app-shell">
            <Sidebar />
            <main className="fv-main">
                {/* ── Top bar ── */}
                <div className="fv-topbar">
                    <button className="sd-back-btn" onClick={() => navigate(`/library/${subjectId}`)}>
                        <ArrowLeft size={16} /> Back
                    </button>

                    <div className="fv-filename">{file.name}</div>

                    {/* Capsule navigation */}
                    <div className="fv-capsule-nav">
                        {TABS.map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                id={`tab-${id.toLowerCase()}`}
                                className={`fv-capsule-btn${tab === id ? ' active' : ''}`}
                                onClick={() => setTab(id)}
                            >
                                <Icon size={13} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Panel content ── */}
                {tab === 'Study'     && <StudyView file={file} />}
                {tab === 'Flashcard' && <FlashcardView file={file} />}
                {tab === 'Quiz'      && <QuizView file={file} />}
            </main>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   CHATBOT PANEL — full-panel RAG chat grounded in the file
═══════════════════════════════════════════════════════════════════ */
function ChatbotPanel({ file, compact }) {
    const [messages, setMessages] = useState([
        { role: 'bot', content: `Hey! 👋 I've read **${file.name}**. Ask me anything about it.` }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const send = async () => {
        const msg = input.trim();
        if (!msg || loading) return;
        setMessages(p => [...p, { role: 'user', content: msg }]);
        setInput('');
        setLoading(true);
        try {
            const res = await fetch(`${BACKEND}/file-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, context: file.extractedText || '' }),
            });
            const data = await res.json();
            setMessages(p => [...p, { role: 'bot', content: data.response }]);
        } catch {
            setMessages(p => [...p, { role: 'bot', content: '⚠️ Could not reach the server.' }]);
        } finally { setLoading(false); }
    };

    return (
        <div className={`cb-panel${compact ? ' compact' : ''}`}>
            {/* Messages */}
            <div className="cb-messages">
                {messages.map((m, i) => (
                    <div key={i} className={`cb-bubble ${m.role}`}>
                        {m.role === 'bot' && <div className="cb-bot-icon">🤖</div>}
                        <div className="cb-bubble-text">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="cb-bubble bot">
                        <div className="cb-bot-icon">🤖</div>
                        <div className="cb-bubble-text cb-typing">
                            <span /><span /><span />
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="cb-input-row">
                <input
                    className="cb-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder="Ask about this document..."
                    disabled={loading}
                />
                <button
                    className="cb-send-btn"
                    onClick={send}
                    disabled={loading || !input.trim()}
                >
                    <SendHorizonal size={16} />
                </button>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   STUDY VIEW — PDF iframe + rich markdown notes (split layout)
═══════════════════════════════════════════════════════════════════ */
function StudyView({ file }) {
    const [notes, setNotes] = useState('');
    const [showChat, setShowChat] = useState(false);

    return (
        <div className="sv-layout">
            {/* PDF Viewer */}
            <div className="sv-pdf">
                <iframe
                    src={file.downloadURL}
                    title={file.name}
                    className="sv-iframe"
                    allow="fullscreen"
                />
            </div>

            {/* Chatbot slide-in panel */}
            <div className={`sv-chat-panel${showChat ? ' open' : ''}`}>
                <div className="sv-chat-topbar">
                    <div className="sv-chat-title">
                        <div className="cb-avatar" style={{ width: 28, height: 28, fontSize: '0.8rem' }}>🤖</div>
                        <span>AI Assistant</span>
                    </div>
                    <button className="sv-chat-close" onClick={() => setShowChat(false)} title="Close chat">
                        <X size={16} />
                    </button>
                </div>
                <ChatbotPanel file={file} compact />
            </div>

            {/* Notes editor + preview */}
            <div className="sv-notes">
                <div className="sv-notes-header">
                    <span>📝 Study Notes</span>
                    <button
                        className={`sv-chat-toggle-btn${showChat ? ' active' : ''}`}
                        onClick={() => setShowChat(v => !v)}
                        title={showChat ? 'Close AI Chat' : 'Open AI Chat'}
                    >
                        <MessageCircle size={15} />
                        {showChat ? 'Close Chat' : 'Ask AI'}
                    </button>
                </div>
                <textarea
                    className="sv-textarea"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={`# ${file.name.replace('.pdf', '')}\n\nStart taking notes here...\n\nTips:\n# Heading\n- Bullet point\n**bold** *italic*`}
                />
                <div className="sv-notes-preview">
                    <div className="sv-preview-label">Preview</div>
                    <div className="sv-preview-body">
                        {notes
                            ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>
                            : <span style={{ color: '#ccc' }}>Your formatted notes will appear here...</span>
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   FLASHCARD VIEW — AI-generated flip cards
═══════════════════════════════════════════════════════════════════ */
function FlashcardView({ file }) {
    const [cards, setCards] = useState([]);
    const [idx, setIdx] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    // Load saved flashcards from Firestore on mount
    useEffect(() => {
        getDoc(doc(db, 'flashcards', file.id)).then(snap => {
            if (snap.exists()) {
                setCards(snap.data().cards || []);
                setSaved(true);
            }
        });
    }, [file.id]);

    const saveToFirestore = async (newCards) => {
        setSaving(true);
        try {
            const uid = auth.currentUser?.uid;
            await setDoc(doc(db, 'flashcards', file.id), {
                uid,
                fileId: file.id,
                cards: newCards,
                savedAt: serverTimestamp(),
            });
            setSaved(true);
        } catch (e) {
            console.error('Flashcard save failed:', e);
            setError(`Save failed: ${e.message}`);
        } finally { setSaving(false); }
    };

    const generate = async () => {
        setLoading(true); setError(''); setSaved(false);
        try {
            const res = await fetch(`${BACKEND}/generate-flashcards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context: file.extractedText || 'No text available.' }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            const newCards = data.cards || [];
            setCards(newCards);
            setIdx(0); setFlipped(false); setShowHint(false);
            await saveToFirestore(newCards);
        } catch {
            setError('Could not generate flashcards. Make sure the backend is running.');
        } finally { setLoading(false); }
    };

    const goNext = () => { setIdx(i => Math.min(i + 1, cards.length - 1)); setFlipped(false); setShowHint(false); };
    const goPrev = () => { setIdx(i => Math.max(i - 1, 0)); setFlipped(false); setShowHint(false); };
    const card = cards[idx];

    return (
        <div className="fc-wrap">
            {cards.length === 0 ? (
                <div className="quiz-start">
                    <Layers size={52} style={{ color: '#86c9a8' }} />
                    <h2>AI Flashcard Generator</h2>
                    <p>Create a study deck from <strong>{file.name}</strong></p>
                    {error && <div className="quiz-error">{error}</div>}
                    <button className="quiz-gen-btn" onClick={generate} disabled={loading}>
                        {loading ? '⏳ Generating...' : '🃏 Generate Flashcards'}
                    </button>
                </div>
            ) : (
                <div className="fc-content">
                    <div className="fc-toprow">
                        <div className="fc-progress">{idx + 1} / {cards.length}</div>
                        {saved && <span className="saved-badge">✓ Saved</span>}
                        {saving && <span className="saving-badge">Saving...</span>}
                    </div>

                    <div className={`fc-card${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
                        <div className="fc-front">
                            <div className="fc-label">Question</div>
                            <div className="fc-text">{card.question}</div>
                            <div className="fc-click-hint">Click to reveal answer</div>
                        </div>
                        <div className="fc-back">
                            <div className="fc-label" style={{ color: 'rgba(255,255,255,0.7)' }}>Answer</div>
                            <div className="fc-text">{card.answer}</div>
                        </div>
                    </div>

                    {!flipped && (
                        <div className="fc-hint-zone">
                            {showHint
                                ? <div className="fc-hint-text">💡 {card.hint}</div>
                                : <button className="fc-hint-btn" onClick={() => setShowHint(true)}>Show Hint</button>
                            }
                        </div>
                    )}

                    <div className="fc-nav">
                        <button className="fc-nav-btn" onClick={goPrev} disabled={idx === 0}>← Prev</button>
                        <button className="fc-nav-btn" onClick={goNext} disabled={idx === cards.length - 1}>Next →</button>
                    </div>
                    <button className="quiz-regen-btn" style={{ marginTop: 8 }} onClick={generate} disabled={loading}>
                        <RotateCcw size={14} /> {loading ? 'Generating...' : 'Regenerate'}
                    </button>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   QUIZ VIEW — 15 AI-generated MCQs
═══════════════════════════════════════════════════════════════════ */
function QuizView({ file }) {
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    // Load saved quiz from Firestore on mount
    useEffect(() => {
        getDoc(doc(db, 'quizzes', file.id)).then(snap => {
            if (snap.exists()) {
                setQuestions(snap.data().questions || []);
                setSaved(true);
            }
        });
    }, [file.id]);

    const saveToFirestore = async (newQuestions) => {
        setSaving(true);
        try {
            const uid = auth.currentUser?.uid;
            await setDoc(doc(db, 'quizzes', file.id), {
                uid,
                fileId: file.id,
                questions: newQuestions,
                savedAt: serverTimestamp(),
            });
            setSaved(true);
        } catch (e) {
            console.error('Quiz save failed:', e);
            setError(`Save failed: ${e.message}`);
        } finally { setSaving(false); }
    };

    const generate = async () => {
        setLoading(true); setError(''); setSaved(false);
        try {
            const res = await fetch(`${BACKEND}/generate-quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context: file.extractedText || 'No text available.' }),
            });
            if (!res.ok) throw new Error('Generation failed');
            const data = await res.json();
            const newQuestions = data.questions || [];
            setQuestions(newQuestions);
            setAnswers({});
            setSubmitted(false);
            await saveToFirestore(newQuestions);
        } catch {
            setError('Could not generate quiz. Make sure the backend is running.');
        } finally { setLoading(false); }
    };

    const score = questions.filter(q => answers[q.question] === q.answer).length;

    return (
        <div className="quiz-wrap">
            {questions.length === 0 ? (
                <div className="quiz-start">
                    <Brain size={52} style={{ color: '#86c9a8' }} />
                    <h2>AI Quiz Generator</h2>
                    <p>Generate a 15-question multiple-choice quiz based on <strong>{file.name}</strong></p>
                    {error && <div className="quiz-error">{error}</div>}
                    <button className="quiz-gen-btn" onClick={generate} disabled={loading}>
                        {loading ? '⏳ Generating...' : '🧠 Generate Quiz'}
                    </button>
                </div>
            ) : (
                <div className="quiz-questions">
                    <div className="quiz-header">
                        <h2>Quiz — {file.name.replace('.pdf', '')}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {saved && <span className="saved-badge">✓ Saved</span>}
                            {saving && <span className="saving-badge">Saving...</span>}
                            <button className="quiz-regen-btn" onClick={generate} disabled={loading}>
                                <RotateCcw size={14} /> {loading ? 'Generating...' : 'Regenerate'}
                            </button>
                        </div>
                    </div>
                    {submitted && (
                        <div className="quiz-score">
                            Score: {score}/{questions.length} ({Math.round(score / questions.length * 100)}%)
                        </div>
                    )}
                    {questions.map((q, i) => (
                        <div
                            key={i}
                            className={`quiz-q-card${submitted
                                ? (answers[q.question] === q.answer ? ' correct' : ' wrong')
                                : ''}`}
                        >
                            <div className="quiz-q-num">Q{i + 1}</div>
                            <div className="quiz-q-text">{q.question}</div>
                            <div className="quiz-options">
                                {q.options.map(opt => (
                                    <label
                                        key={opt}
                                        className={`quiz-opt${answers[q.question] === opt.charAt(0) ? ' chosen' : ''}${submitted && opt.charAt(0) === q.answer ? ' correct-opt' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name={`q${i}`}
                                            disabled={submitted}
                                            checked={answers[q.question] === opt.charAt(0)}
                                            onChange={() => setAnswers(a => ({ ...a, [q.question]: opt.charAt(0) }))}
                                        />
                                        {opt}
                                    </label>
                                ))}
                            </div>
                            {submitted && (
                                <div className="quiz-explanation">💡 {q.explanation}</div>
                            )}
                        </div>
                    ))}
                    {!submitted && (
                        <button
                            className="quiz-submit-btn"
                            onClick={() => setSubmitted(true)}
                            disabled={Object.keys(answers).length < questions.length}
                        >
                            Submit Answers
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
