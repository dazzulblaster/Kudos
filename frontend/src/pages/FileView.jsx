import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Sidebar from '../components/Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    ArrowLeft, MessageCircle, BookOpen, Layers, Brain,
    RotateCcw, SendHorizonal, X, Eye, Code, Save, Check,
    Bold, Italic, Heading2, Heading3, List, ListOrdered,
    Code2, Strikethrough, Quote
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

        const botIdx = messages.length + 1;
        setMessages(p => [...p, { role: 'bot', content: '' }]);

        try {
            const res = await fetch(`${BACKEND}/file-chat-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, context: file.extractedText || '' }),
            });
            if (!res.ok) throw new Error('Stream failed');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6);
                    if (payload === '[DONE]') break;
                    try {
                        const { text: chunk } = JSON.parse(payload);
                        accumulated += chunk;
                        setMessages(p => {
                            const updated = [...p];
                            updated[botIdx] = { role: 'bot', content: accumulated };
                            return updated;
                        });
                    } catch { /* skip */ }
                }
            }

            if (!accumulated) {
                setMessages(p => {
                    const updated = [...p];
                    updated[botIdx] = { role: 'bot', content: 'Sorry, I could not respond.' };
                    return updated;
                });
            }
        } catch {
            setMessages(p => {
                const updated = [...p];
                updated[botIdx] = { role: 'bot', content: '⚠️ Could not reach the server.' };
                return updated;
            });
        } finally { setLoading(false); }
    };

    return (
        <div className={`cb-panel${compact ? ' compact' : ''}`}>
            {/* Messages */}
            <div className="cb-messages">
                {messages.map((m, i) => (
                    (m.role === 'user' || m.content) ? (
                        <div key={i} className={`cb-bubble ${m.role}`}>
                            {m.role === 'bot' && <div className="cb-bot-icon">🤖</div>}
                            <div className="cb-bubble-text">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                            </div>
                        </div>
                    ) : null
                ))}
                {loading && messages[messages.length - 1]?.content === '' && (
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
   Notes auto-save to Firestore with 1-second debounce
═══════════════════════════════════════════════════════════════════ */
function StudyView({ file }) {
    const [notes, setNotes] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [viewMode, setViewMode] = useState('code'); // 'code' or 'preview'
    const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
    const [loadingNotes, setLoadingNotes] = useState(true);
    const debounceRef = useRef(null);

    // ── Resizable panel state ──
    const layoutRef = useRef(null);
    const [pdfWidth, setPdfWidth] = useState(50); // percentage
    const [chatWidth, setChatWidth] = useState(25); // percentage (when open)
    const draggingRef = useRef(null); // 'pdf' | 'chat' | null
    const [isDragging, setIsDragging] = useState(false);

    // ── Floating format toolbar state ──
    const textareaRef = useRef(null);
    const toolbarRef = useRef(null);
    const [showToolbar, setShowToolbar] = useState(false);
    const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });

    // Load saved notes from Firestore on mount
    useEffect(() => {
        const loadNotes = async () => {
            try {
                const snap = await getDoc(doc(db, 'files', file.id));
                if (snap.exists() && snap.data().studyNotes) {
                    setNotes(snap.data().studyNotes);
                }
            } catch (e) {
                console.error('Failed to load study notes:', e);
            } finally {
                setLoadingNotes(false);
            }
        };
        loadNotes();
    }, [file.id]);

    // Auto-save with 1-second debounce
    const saveNotes = useCallback(async (text) => {
        setSaveStatus('saving');
        try {
            await updateDoc(doc(db, 'files', file.id), {
                studyNotes: text,
            });
            setSaveStatus('saved');
            // Reset to idle after 2 seconds
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) {
            console.error('Failed to save study notes:', e);
            setSaveStatus('idle');
        }
    }, [file.id]);

    const handleNotesChange = (e) => {
        const text = e.target.value;
        setNotes(text);
        setSaveStatus('idle');

        // Clear previous debounce timer
        if (debounceRef.current) clearTimeout(debounceRef.current);

        // Set new 1-second debounce
        debounceRef.current = setTimeout(() => {
            saveNotes(text);
        }, 1000);
    };

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // ── Drag resize handlers ──
    const handleMouseDown = useCallback((handle) => (e) => {
        e.preventDefault();
        draggingRef.current = handle;
        setIsDragging(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!draggingRef.current || !layoutRef.current) return;
            const rect = layoutRef.current.getBoundingClientRect();
            const totalW = rect.width;
            const x = e.clientX - rect.left;
            const pct = (x / totalW) * 100;

            if (draggingRef.current === 'pdf') {
                // Dragging the PDF right edge
                const min = 20, max = showChat ? 60 : 75;
                setPdfWidth(Math.max(min, Math.min(max, pct)));
            } else if (draggingRef.current === 'chat') {
                // Dragging the chat right edge
                const chatRight = pct;
                const newChatW = chatRight - pdfWidth;
                const minChat = 15, maxChat = 45;
                if (newChatW >= minChat && newChatW <= maxChat) {
                    setChatWidth(newChatW);
                }
            }
        };

        const handleMouseUp = () => {
            if (draggingRef.current) {
                draggingRef.current = null;
                setIsDragging(false);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [pdfWidth, showChat]);

    // ── Floating toolbar: caret coordinate calculation ──
    const getCaretCoordinates = useCallback((textarea, position) => {
        const mirror = document.createElement('div');
        const computed = window.getComputedStyle(textarea);
        const props = [
            'fontFamily','fontSize','fontWeight','fontStyle','letterSpacing',
            'textTransform','wordSpacing','lineHeight','paddingTop','paddingRight',
            'paddingBottom','paddingLeft','borderTopWidth','borderRightWidth',
            'borderBottomWidth','borderLeftWidth','boxSizing','width'
        ];
        mirror.style.position = 'absolute';
        mirror.style.top = '-9999px';
        mirror.style.left = '-9999px';
        mirror.style.visibility = 'hidden';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.wordWrap = 'break-word';
        mirror.style.overflow = 'hidden';
        props.forEach(p => { mirror.style[p] = computed[p]; });
        mirror.appendChild(document.createTextNode(textarea.value.substring(0, position)));
        const marker = document.createElement('span');
        marker.textContent = '\u200b';
        mirror.appendChild(marker);
        document.body.appendChild(mirror);
        const mirrorRect = mirror.getBoundingClientRect();
        const markerRect = marker.getBoundingClientRect();
        const textareaRect = textarea.getBoundingClientRect();
        const coords = {
            top: textareaRect.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop,
            left: textareaRect.left + (markerRect.left - mirrorRect.left) - textarea.scrollLeft,
        };
        document.body.removeChild(mirror);
        return coords;
    }, []);

    // ── Floating toolbar: detect selection ──
    const handleSelection = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const { selectionStart, selectionEnd } = textarea;
        if (selectionStart !== selectionEnd) {
            const coords = getCaretCoordinates(textarea, selectionStart);
            const toolbarW = 340;
            setToolbarPos({
                top: Math.max(8, coords.top - 42),
                left: Math.max(8, Math.min(coords.left, window.innerWidth - toolbarW - 8)),
            });
            setShowToolbar(true);
        } else {
            setShowToolbar(false);
        }
    }, [getCaretCoordinates]);

    // ── Floating toolbar: apply markdown formatting ──
    const applyFormat = useCallback((prefix, suffix = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = notes.substring(start, end);
        const replacement = prefix + selected + suffix;
        const newText = notes.substring(0, start) + replacement + notes.substring(end);
        setNotes(newText);
        setSaveStatus('idle');
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { saveNotes(newText); }, 1000);
        setShowToolbar(false);
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.selectionStart = start + prefix.length;
            textarea.selectionEnd = start + prefix.length + selected.length;
        });
    }, [notes, saveNotes]);

    // ── Floating toolbar: hide on outside click ──
    useEffect(() => {
        if (!showToolbar) return;
        const hide = (e) => {
            if (toolbarRef.current?.contains(e.target)) return;
            if (textareaRef.current?.contains(e.target)) return;
            setShowToolbar(false);
        };
        document.addEventListener('mousedown', hide);
        return () => document.removeEventListener('mousedown', hide);
    }, [showToolbar]);

    // Calculate notes width
    const notesWidth = showChat ? (100 - pdfWidth - chatWidth) : (100 - pdfWidth);

    return (
        <div className={`sv-layout${isDragging ? ' sv-dragging' : ''}`} ref={layoutRef}>
            {/* ── PDF Viewer ── */}
            <div className="sv-pdf" style={{ width: `${pdfWidth}%`, flex: 'none' }}>
                <iframe
                    src={file.downloadURL}
                    title={file.name}
                    className="sv-iframe"
                    allow="fullscreen"
                />
            </div>

            {/* ── Resize handle: PDF ↔ Chat/Notes ── */}
            <div className="sv-resize-handle" onMouseDown={handleMouseDown('pdf')} title="Drag to resize">
                <div className="sv-resize-dots" />
            </div>

            {/* ── Chatbot slide-in panel ── */}
            {showChat && (
                <>
                    <div className="sv-chat-panel open" style={{ width: `${chatWidth}%`, flex: 'none' }}>
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

                    {/* ── Resize handle: Chat ↔ Notes ── */}
                    <div className="sv-resize-handle" onMouseDown={handleMouseDown('chat')} title="Drag to resize">
                        <div className="sv-resize-dots" />
                    </div>
                </>
            )}

            {/* ── Notes panel with Preview/Code toggle ── */}
            <div className="sv-notes" style={{ width: `${notesWidth}%`, flex: 'none' }}>
                <div className="sv-notes-header">
                    <div className="sv-notes-header-left">
                        <span>📝 Study Notes</span>
                        {/* Save status indicator */}
                        {saveStatus === 'saving' && (
                            <span className="sv-save-status saving">
                                <Save size={12} /> Saving...
                            </span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="sv-save-status saved">
                                <Check size={12} /> Saved
                            </span>
                        )}
                    </div>
                    <div className="sv-notes-header-right">
                        {/* Preview / Code toggle */}
                        <div className="sv-mode-toggle">
                            <button
                                className={`sv-mode-btn${viewMode === 'code' ? ' active' : ''}`}
                                onClick={() => setViewMode('code')}
                                title="Edit markdown"
                            >
                                <Code size={14} />
                            </button>
                            <button
                                className={`sv-mode-btn${viewMode === 'preview' ? ' active' : ''}`}
                                onClick={() => setViewMode('preview')}
                                title="Preview"
                            >
                                <Eye size={14} />
                            </button>
                        </div>
                        <button
                            className={`sv-chat-toggle-btn${showChat ? ' active' : ''}`}
                            onClick={() => setShowChat(v => !v)}
                            title={showChat ? 'Close AI Chat' : 'Open AI Chat'}
                        >
                            <MessageCircle size={15} />
                            {showChat ? 'Close Chat' : 'Ask AI'}
                        </button>
                    </div>
                </div>

                {loadingNotes ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="spin" style={{ width: 28, height: 28, borderTopColor: '#86c9a8' }} />
                    </div>
                ) : viewMode === 'code' ? (
                    <textarea
                        ref={textareaRef}
                        className="sv-textarea"
                        value={notes}
                        onChange={handleNotesChange}
                        onMouseUp={handleSelection}
                        onKeyUp={handleSelection}
                        placeholder={`# ${file.name.replace('.pdf', '')}\n\nStart taking notes here...\n\nTips:\n# Heading\n- Bullet point\n**bold** *italic*`}
                    />
                ) : (
                    <div className="sv-preview-full">
                        <div className="sv-preview-body">
                            {notes
                                ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>
                                : <span style={{ color: '#ccc' }}>Your formatted notes will appear here...</span>
                            }
                        </div>
                    </div>
                )}

                {/* ── Floating format toolbar ── */}
                {showToolbar && viewMode === 'code' && (
                    <div
                        ref={toolbarRef}
                        className="sv-format-toolbar"
                        style={{ top: toolbarPos.top, left: toolbarPos.left }}
                        onMouseDown={e => e.preventDefault()}
                    >
                        <button onClick={() => applyFormat('**', '**')} title="Bold">
                            <Bold size={14} />
                        </button>
                        <button onClick={() => applyFormat('*', '*')} title="Italic">
                            <Italic size={14} />
                        </button>
                        <button onClick={() => applyFormat('***', '***')} title="Bold + Italic">
                            <span style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                <Bold size={11} /><Italic size={11} />
                            </span>
                        </button>
                        <button onClick={() => applyFormat('~~', '~~')} title="Strikethrough">
                            <Strikethrough size={14} />
                        </button>
                        <span className="sv-fmt-divider" />
                        <button onClick={() => applyFormat('## ', '')} title="Heading 2">
                            <Heading2 size={14} />
                        </button>
                        <button onClick={() => applyFormat('### ', '')} title="Heading 3">
                            <Heading3 size={14} />
                        </button>
                        <span className="sv-fmt-divider" />
                        <button onClick={() => applyFormat('- ', '')} title="Bullet List">
                            <List size={14} />
                        </button>
                        <button onClick={() => applyFormat('1. ', '')} title="Numbered List">
                            <ListOrdered size={14} />
                        </button>
                        <span className="sv-fmt-divider" />
                        <button onClick={() => applyFormat('`', '`')} title="Inline Code">
                            <Code2 size={14} />
                        </button>
                        <button onClick={() => applyFormat('> ', '')} title="Blockquote">
                            <Quote size={14} />
                        </button>
                    </div>
                )}
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
                            <div className="quiz-q-num">
                                Q{i + 1}
                                {submitted && (
                                    answers[q.question] === q.answer
                                        ? <span className="quiz-q-badge correct">✓ Correct</span>
                                        : <span className="quiz-q-badge wrong">✗ Wrong</span>
                                )}
                            </div>
                            <div className="quiz-q-text">{q.question}</div>
                            <div className="quiz-options">
                                {q.options.map(opt => {
                                    const letter = opt.charAt(0);
                                    const isChosen = answers[q.question] === letter;
                                    const isCorrect = letter === q.answer;
                                    let cls = 'quiz-opt';
                                    if (isChosen) cls += ' chosen';
                                    if (submitted && isCorrect) cls += ' correct-opt';
                                    if (submitted && !isCorrect && isChosen) cls += ' wrong-opt';
                                    return (
                                    <label key={opt} className={cls}>
                                        <input
                                            type="radio"
                                            name={`q${i}`}
                                            disabled={submitted}
                                            checked={answers[q.question] === opt.charAt(0)}
                                            onChange={() => setAnswers(a => ({ ...a, [q.question]: opt.charAt(0) }))}
                                        />
                                        {opt}
                                    </label>
                                    );
                                })}
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
