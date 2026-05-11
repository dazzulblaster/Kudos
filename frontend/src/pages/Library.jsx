import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection, addDoc, getDocs, deleteDoc, doc,
    query, where, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import Sidebar from '../components/Sidebar';
import { FolderPlus, FolderOpen, Trash2, ArrowRight, Search } from 'lucide-react';
import '../App.css';
import './Library.css';

export default function Library() {
    const navigate = useNavigate();
    const [subjects, setSubjects] = useState([]);
    const [user, setUser] = useState(null);
    const [fetching, setFetching] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const CARD_COLORS = [
        { accent: '#86c9a8', pale: '#eef9f4' },
        { accent: '#8b5cf6', pale: '#f5f3ff' },
        { accent: '#f59e0b', pale: '#fffbeb' },
        { accent: '#3b82f6', pale: '#eff6ff' },
        { accent: '#f87171', pale: '#fef2f2' },
    ];

    const filtered = subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => setUser(u));
        return unsub;
    }, []);

    const fetchSubjects = async (u) => {
        if (!u) { setFetching(false); return; }
        setFetching(true);
        try {
            const q = query(collection(db, 'subjects'), where('uid', '==', u.uid));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setSubjects(list);
        } catch (e) { console.error(e); }
        finally { setFetching(false); }
    };

    useEffect(() => { fetchSubjects(user); }, [user]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!folderName.trim()) return;
        setLoading(true);
        try {
            const ref = await addDoc(collection(db, 'subjects'), {
                uid: user.uid,
                name: folderName.trim(),
                description: '',
                createdAt: serverTimestamp(),
            });
            setSubjects(prev => [{ id: ref.id, name: folderName.trim(), description: '' }, ...prev]);
            setFolderName('');
            setShowModal(false);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        await deleteDoc(doc(db, 'subjects', id));
        setSubjects(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <main className="main-content">
                {/* Header */}
                <div className="page-top-bar">
                    <div>
                        <h1 className="lib-heading">My Library</h1>
                        <p className="lib-sub">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div className="lib-search-wrap">
                            <Search size={15} color="#9ca3af" />
                            <input
                                className="lib-search"
                                placeholder="Search subjects..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <button className="lib-new-btn" onClick={() => setShowModal(true)}>
                            <FolderPlus size={17} /> New Folder
                        </button>
                    </div>
                </div>

                {/* Grid */}
                {fetching ? (
                    <div style={{ textAlign: 'center', padding: 60 }}>
                        <span className="spin" style={{ width: 30, height: 30, borderTopColor: '#86c9a8' }} />
                    </div>
                ) : subjects.length === 0 ? (
                    <div className="empty-box">
                        <div className="empty-icon">📚</div>
                        <p>No subjects yet — click <strong>New Folder</strong> to create one!</p>
                    </div>
                ) : (
                    <div className="lib-grid">
                        {filtered.map((subject, i) => {
                            const color = CARD_COLORS[i % CARD_COLORS.length];
                            return (
                                <div
                                    key={subject.id}
                                    className="lib-card"
                                    onClick={() => navigate(`/library/${subject.id}`)}
                                >
                                    <div className="lib-card-accent" style={{ background: color.accent }} />
                                    <div className="lib-card-body">
                                        <div className="lib-card-icon" style={{ background: color.pale, color: color.accent }}>
                                            <FolderOpen size={22} />
                                        </div>
                                        <div className="lib-card-name">{subject.name}</div>
                                        <div className="lib-card-desc">
                                            {subject.description || 'Click to open and manage files'}
                                        </div>
                                        <div className="lib-card-footer">
                                            <span className="lib-card-open" style={{ color: color.accent }}>
                                                Open <ArrowRight size={12} />
                                            </span>
                                            <button
                                                className="lib-delete-btn"
                                                onClick={(e) => handleDelete(e, subject.id)}
                                                title="Delete folder"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* New Folder Modal */}
            {showModal && (
                <div className="modal-bg" onClick={() => setShowModal(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-head">
                            <h2>📁 New Subject Folder</h2>
                            <button className="modal-close-btn" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-field">
                                <label className="modal-label">Subject Name</label>
                                <input
                                    className="modal-input"
                                    placeholder="e.g. Machine Learning"
                                    value={folderName}
                                    onChange={e => setFolderName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="modal-btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="modal-btn-save" disabled={loading}>
                                    {loading ? <span className="spin" /> : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
