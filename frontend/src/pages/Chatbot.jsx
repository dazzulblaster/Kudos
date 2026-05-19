import { useState, useRef, useEffect } from 'react';
import { auth } from '../firebase';
import Sidebar from '../components/Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../App.css';

const BACKEND_URL = 'http://localhost:8000';

const SUGGESTIONS = [
    'Explain photosynthesis simply 🌿',
    'Help me make a study plan 📅',
    'What is machine learning? 🤖',
    "Summarise Newton's laws ⚙️",
];

export default function Chatbot() {
    const [messages, setMessages] = useState([
        { role: 'bot', content: "Hi! I'm Kudos AI 👋 — your study assistant powered by Gemini. Ask me anything!" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    const user = auth.currentUser;

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (text) => {
        const msg = (text || input).trim();
        if (!msg || loading) return;
        setMessages(prev => [...prev, { role: 'user', content: msg }]);
        setInput('');
        setLoading(true);

        // Add an empty bot message that we'll stream into
        const botIdx = messages.length + 1; // +1 for the user message we just added
        setMessages(prev => [...prev, { role: 'bot', content: '' }]);

        try {
            const res = await fetch(`${BACKEND_URL}/chat-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, user_id: user?.uid }),
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
                buffer = lines.pop(); // keep incomplete line in buffer

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6);
                    if (payload === '[DONE]') break;
                    try {
                        const { text: chunk } = JSON.parse(payload);
                        accumulated += chunk;
                        setMessages(prev => {
                            const updated = [...prev];
                            updated[botIdx] = { role: 'bot', content: accumulated };
                            return updated;
                        });
                    } catch { /* skip malformed */ }
                }
            }

            // Final safeguard: if nothing streamed, show fallback
            if (!accumulated) {
                setMessages(prev => {
                    const updated = [...prev];
                    updated[botIdx] = { role: 'bot', content: 'Sorry, I could not respond.' };
                    return updated;
                });
            }
        } catch {
            setMessages(prev => {
                const updated = [...prev];
                updated[botIdx] = { role: 'bot', content: '⚠️ Cannot reach server. Make sure the backend is running.' };
                return updated;
            });
        } finally { setLoading(false); }
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="page-top-bar" style={{ marginBottom: 16 }}>
                    <div>
                        <h1 className="page-heading">Kudos AI</h1>
                        <p className="page-sub">Powered by Google Gemini — ask anything!</p>
                    </div>
                </div>

                <div className="chat-wrap">
                    {/* Header */}
                    <div className="chat-header-bar">
                        <div className="chat-ai-icon"><img src="/ai-icon.png" alt="AI" style={{ width: 22, height: 22, objectFit: 'contain' }} /></div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Kudos AI</div>
                            <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>{loading ? '✨ Streaming...' : '🟢 Online'}</div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="chat-msgs">
                        {messages.map((msg, i) => (
                            (msg.role === 'user' || msg.content) ? (
                                <div key={i} className={`chat-bubble-wrap ${msg.role}`}>
                                    {msg.role === 'bot' && (
                                        <div style={{
                                            width: 30, height: 30, background: '#86c9a8', borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, overflow: 'hidden', padding: 4,
                                        }}><img src="/ai-icon.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
                                    )}
                                    <div className={`chat-bubble ${msg.role}`}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                    </div>
                                </div>
                            ) : null
                        ))}

                        {loading && messages[messages.length - 1]?.content === '' && (
                            <div className="chat-bubble-wrap bot">
                                <div style={{ width: 30, height: 30, background: '#86c9a8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4 }}><img src="/ai-icon.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
                                <div className="chat-bubble bot" style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '14px 16px' }}>
                                    {[0, 1, 2].map(i => (
                                        <span key={i} style={{ width: 7, height: 7, background: '#86c9a8', borderRadius: '50%', display: 'inline-block', animation: `bounce 1s infinite ${i * 0.2}s` }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Suggestion chips */}
                    {messages.length === 1 && (
                        <div style={{ padding: '8px 20px 4px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {SUGGESTIONS.map((s, i) => (
                                <button key={i} onClick={() => sendMessage(s)}
                                    style={{
                                        padding: '6px 14px', borderRadius: 20, border: '1.5px solid #c6e8d8',
                                        background: '#f0f9f5', color: '#4a9a78', fontSize: '0.81rem',
                                        cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500,
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#86c9a8'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#f0f9f5'; e.currentTarget.style.color = '#4a9a78'; }}
                                >{s}</button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="chat-input-bar">
                        <textarea
                            className="chat-text-input"
                            rows={1}
                            placeholder="Ask me anything about your studies..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            disabled={loading}
                            style={{ resize: 'none' }}
                        />
                        <button className="chat-send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                            {loading ? <span className="spin" style={{ width: 16, height: 16 }} /> : '➤'}
                        </button>
                    </div>
                </div>
            </main>

            <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
        </div>
    );
}
