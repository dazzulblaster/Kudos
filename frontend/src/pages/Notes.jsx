import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection, addDoc, getDocs, deleteDoc, doc,
    query, where, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import Sidebar from '../components/Sidebar';
import '../App.css';

export default function Notes() {
    const navigate = useNavigate();
    const [notes, setNotes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ title: '', content: '' });
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [user, setUser] = useState(null);

    // Wait for Firebase Auth to resolve before fetching
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
        });
        return unsub;
    }, []);

    const fetchNotes = async (u) => {
        if (!u) { setFetching(false); return; }
        setFetching(true);
        try {
            const q = query(
                collection(db, 'notes'),
                where('uid', '==', u.uid)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort client-side to avoid needing a Firestore composite index
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setNotes(list);
        } catch (e) { console.error('Fetch notes error:', e); }
        finally { setFetching(false); }
    };

    // Fetch notes whenever user changes
    useEffect(() => {
        fetchNotes(user);
    }, [user]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        setLoading(true);
        try {
            const ref = await addDoc(collection(db, 'notes'), {
                uid: user.uid,
                title: form.title.trim(),
                content: form.content.trim(),
                createdAt: serverTimestamp(),
            });
            setForm({ title: '', content: '' });
            setShowModal(false);
            navigate(`/notes/${ref.id}`);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        await deleteDoc(doc(db, 'notes', id));
        setNotes(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <main className="main-content">
                <div className="page-top-bar">
                    <div>
                        <h1 className="page-heading" style={{ fontSize: '1.6rem', fontWeight: 800 }}>My Notes</h1>
                    </div>
                    <button className="btn-add" onClick={() => setShowModal(true)}>+ New Note</button>
                </div>

                {fetching ? (
                    <div style={{ textAlign: 'center', padding: 60 }}><span className="spin" style={{ borderTopColor: '#86c9a8', width: 30, height: 30 }} /></div>
                ) : notes.length === 0 ? (
                    <div className="empty-box">
                        <div className="empty-icon">📖</div>
                        <p>No notes yet — click <strong>+ New Note</strong> to start!</p>
                    </div>
                ) : (
                    <div className="notes-grid">
                        {notes.map(note => (
                            <div
                                className="note-card"
                                key={note.id}
                                onClick={() => navigate(`/notes/${note.id}`)}
                            >
                                <div className="note-card-title">{note.title}</div>
                                <div className="note-card-preview">
                                    {note.content
                                        ? note.content.replace(/[#*`>~\-_]/g, '').slice(0, 80) + (note.content.length > 80 ? '...' : '')
                                        : 'Start writing your notes here...'}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                                        title="Delete note"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.05rem', padding: 2, lineHeight: 1, filter: 'brightness(0) saturate(100%) invert(27%) sepia(90%) saturate(700%) hue-rotate(330deg)' }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {showModal && (
                <div className="modal-bg" onClick={() => setShowModal(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>📝 New Note</h2>
                            <button className="modal-close-btn" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-field">
                                <label className="modal-label">Title</label>
                                <input className="modal-input" placeholder="Note title..." value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })} required autoFocus />
                            </div>
                            <div className="modal-field">
                                <label className="modal-label">Content</label>
                                <textarea className="modal-textarea" placeholder="Write your note here..." value={form.content}
                                    onChange={e => setForm({ ...form, content: e.target.value })} rows={5} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="modal-btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="modal-btn-save" disabled={loading}>
                                    {loading ? <span className="spin" /> : 'Save Note'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
