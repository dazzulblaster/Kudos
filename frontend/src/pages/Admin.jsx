import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import {
    Shield, Users, Pencil, Trash2, LogOut,
    Check, X, AlertTriangle, Search, RefreshCw, KeyRound
} from 'lucide-react';
import './Admin.css';

const BACKEND = 'http://localhost:8000';

async function adminFetch(path, options = {}) {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${BACKEND}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || 'Request failed');
    }
    return res.json();
}

export default function Admin() {
    const navigate = useNavigate();
    const adminUser = auth.currentUser;

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    // Inline edit state
    const [editingUid, setEditingUid] = useState(null);
    const [editUsername, setEditUsername] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    // Delete confirm modal
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Toast notification
    const [toast, setToast] = useState(null);

    const showToast = (type, text) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3500);
    };

    const loadUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await adminFetch('/admin/users');
            setUsers(data.users || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const handleEditSave = async (uid) => {
        if (!editUsername.trim()) return;
        setEditLoading(true);
        try {
            await adminFetch(`/admin/users/${uid}`, {
                method: 'PATCH',
                body: JSON.stringify({ username: editUsername.trim() }),
            });
            setUsers(prev => prev.map(u => u.id === uid ? { ...u, username: editUsername.trim() } : u));
            setEditingUid(null);
            showToast('success', 'Username updated successfully.');
        } catch (e) {
            showToast('error', e.message);
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            await adminFetch(`/admin/users/${deleteTarget.uid}`, { method: 'DELETE' });
            setUsers(prev => prev.filter(u => u.id !== deleteTarget.uid));
            setDeleteTarget(null);
            showToast('success', `User "${deleteTarget.username}" deleted.`);
        } catch (e) {
            showToast('error', e.message);
            setDeleteTarget(null);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleResetPassword = async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
            showToast('success', `Password reset email sent to ${email}`);
        } catch (e) {
            showToast('error', 'Failed to send reset email.');
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const filtered = users.filter(u =>
        (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase())
    );

    const formatDate = (val) => {
        if (!val) return '—';
        const d = val?.seconds ? new Date(val.seconds * 1000) : new Date(val);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="adm-page">

            {/* Toast */}
            {toast && (
                <div className={`adm-toast adm-toast--${toast.type}`}>
                    {toast.type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
                    {toast.text}
                </div>
            )}

            {/* Delete confirm modal */}
            {deleteTarget && (
                <div className="modal-bg" onClick={() => !deleteLoading && setDeleteTarget(null)}>
                    <div className="adm-modal" onClick={e => e.stopPropagation()}>
                        <div className="adm-modal-icon">
                            <Trash2 size={24} color="#ef4444" />
                        </div>
                        <h2 className="adm-modal-title">Delete User?</h2>
                        <p className="adm-modal-body">
                            This will permanently delete <strong>{deleteTarget.username}</strong>'s account
                            and remove all their data. This cannot be undone.
                        </p>
                        <div className="adm-modal-actions">
                            <button className="adm-modal-cancel" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
                                Cancel
                            </button>
                            <button className="adm-modal-confirm" onClick={handleDelete} disabled={deleteLoading}>
                                {deleteLoading
                                    ? <span className="spin" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                    : <><Trash2 size={14} /> Delete</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="adm-container">

                {/* ── Header ── */}
                <div className="adm-header">
                    <div className="adm-header-left">
                        <div className="adm-header-avatar">
                            <Shield size={22} color="#fff" />
                        </div>
                        <div>
                            <div className="adm-header-title">Admin Dashboard</div>
                            <div className="adm-header-sub">Manage all users</div>
                        </div>
                    </div>
                    <button className="adm-logout-btn" onClick={handleLogout}>
                        <LogOut size={15} /> Logout
                    </button>
                </div>

                {/* ── Stats ── */}
                <div className="adm-stats">
                    <div className="adm-stat">
                        <span className="adm-stat-label">Total Users</span>
                        <span className="adm-stat-value">{loading ? '—' : users.length}</span>
                    </div>
                    <div className="adm-stat">
                        <span className="adm-stat-label">Showing</span>
                        <span className="adm-stat-value">{loading ? '—' : filtered.length}</span>
                    </div>
                </div>

                {/* ── User Management ── */}
                <div className="adm-panel">
                    <div className="adm-panel-header">
                        <h2 className="adm-panel-title">
                            <Users size={16} /> User Management
                        </h2>
                        <div className="adm-toolbar">
                            <div className="adm-search">
                                <Search size={14} className="adm-search-icon" />
                                <input
                                    className="adm-search-input"
                                    placeholder="Search users…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <button className="adm-refresh" onClick={loadUsers} title="Refresh">
                                <RefreshCw size={15} />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="adm-error">
                            <AlertTriangle size={15} /> {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="adm-state">
                            <span className="spin" style={{ width: 28, height: 28, borderTopColor: '#86c9a8', borderWidth: 3 }} />
                            <span>Loading users…</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="adm-state">
                            <Users size={36} color="#cbd5e1" />
                            <p>{search ? 'No users match your search.' : 'No users found. Users appear here once they register.'}</p>
                        </div>
                    ) : (
                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Email</th>
                                        <th>Password</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(u => (
                                        <tr key={u.id} className={u.id === adminUser?.uid ? 'adm-row-self' : ''}>
                                            <td>
                                                {editingUid === u.id ? (
                                                    <div className="adm-edit-inline">
                                                        <input
                                                            className="adm-edit-input"
                                                            value={editUsername}
                                                            onChange={e => setEditUsername(e.target.value)}
                                                            autoFocus
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleEditSave(u.id);
                                                                if (e.key === 'Escape') setEditingUid(null);
                                                            }}
                                                        />
                                                        <button
                                                            className="adm-icon-btn adm-btn-save"
                                                            onClick={() => handleEditSave(u.id)}
                                                            disabled={editLoading}
                                                        >
                                                            {editLoading
                                                                ? <span className="spin" style={{ width: 12, height: 12, borderWidth: 2 }} />
                                                                : <Check size={13} />}
                                                        </button>
                                                        <button
                                                            className="adm-icon-btn adm-btn-cancel"
                                                            onClick={() => setEditingUid(null)}
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="adm-username">
                                                        {u.username || '—'}
                                                        {u.id === adminUser?.uid && (
                                                            <span className="adm-badge">You</span>
                                                        )}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="adm-email">{u.email}</td>
                                            <td className="adm-password">••••••••</td>
                                            <td>
                                                <div className="adm-actions">
                                                    <button
                                                        className="adm-icon-btn adm-btn-edit"
                                                        title="Edit username"
                                                        onClick={() => {
                                                            setEditingUid(u.id);
                                                            setEditUsername(u.username || '');
                                                        }}
                                                        disabled={editingUid !== null}
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        className="adm-icon-btn adm-btn-reset"
                                                        title="Send password reset email"
                                                        onClick={() => handleResetPassword(u.email)}
                                                    >
                                                        <KeyRound size={14} />
                                                    </button>
                                                    {u.id !== adminUser?.uid && (
                                                        <button
                                                            className="adm-icon-btn adm-btn-delete"
                                                            title="Delete user"
                                                            onClick={() => setDeleteTarget({ uid: u.id, username: u.username || u.email })}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
