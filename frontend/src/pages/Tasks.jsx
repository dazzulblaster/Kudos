import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc,
    query, where, serverTimestamp, orderBy
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import Sidebar from '../components/Sidebar';
import {
    Plus, CheckCircle2, Circle, Trash2, Pencil, CalendarDays,
    Flag, Tag, TrendingUp, Clock, AlertCircle, X, Filter, Settings
} from 'lucide-react';
import '../App.css';
import './Tasks.css';

const PRIORITIES = [
    { value: 'high',   label: 'High',   color: '#ef4444', bg: '#fef2f2' },
    { value: 'medium', label: 'Medium', color: '#f59e0b', bg: '#fffbeb' },
    { value: 'low',    label: 'Low',    color: '#22c55e', bg: '#f0fdf4' },
];

const DEFAULT_CATEGORIES = ['Exam', 'Assignment', 'Reading', 'Project', 'Lab', 'Revision', 'Other'];

const EMPTY_FORM = { title: '', description: '', dueDate: '', priority: 'medium', category: 'Other' };

function isOverdue(dueDate) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
}

function daysLeft(dueDate) {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate) - new Date(new Date().toDateString())) / 86400000);
    return diff;
}

function DueBadge({ dueDate }) {
    if (!dueDate) return null;
    const d = daysLeft(dueDate);
    const formatted = new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (d < 0)  return <span className="due-badge overdue"><AlertCircle size={11}/> Overdue · {formatted}</span>;
    if (d === 0) return <span className="due-badge today"><Clock size={11}/> Due today</span>;
    if (d <= 3)  return <span className="due-badge soon"><Clock size={11}/> {d}d left · {formatted}</span>;
    return <span className="due-badge normal"><CalendarDays size={11}/> {formatted}</span>;
}

export default function Tasks() {
    const [tasks, setTasks]       = useState([]);
    const [tab, setTab]           = useState('active');
    const [showModal, setShowModal] = useState(false);
    const [editTask, setEditTask] = useState(null);
    const [form, setForm]         = useState(EMPTY_FORM);
    const [loading, setLoading]   = useState(false);
    const [fetching, setFetching] = useState(true);
    const [user, setUser]         = useState(null);
    const [saveError, setSaveError] = useState('');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [sortBy, setSortBy]     = useState('created'); // 'created' | 'due' | 'priority'
    const [showFilters, setShowFilters] = useState(false);

    // ── Custom categories state ──
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
    const [showTagManager, setShowTagManager] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [tagError, setTagError] = useState('');

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => setUser(u));
        return unsub;
    }, []);

    // ── Load custom categories from Firestore ──
    useEffect(() => {
        if (!user) return;
        const loadCategories = async () => {
            try {
                const snap = await getDoc(doc(db, 'userSettings', user.uid));
                if (snap.exists() && snap.data().categories) {
                    setCategories(snap.data().categories);
                } else {
                    // First time — seed with defaults
                    await setDoc(doc(db, 'userSettings', user.uid), { categories: DEFAULT_CATEGORIES }, { merge: true });
                }
            } catch (e) { console.error('Load categories error:', e); }
        };
        loadCategories();
    }, [user]);

    const saveCategories = async (updated) => {
        setCategories(updated);
        try {
            await setDoc(doc(db, 'userSettings', user.uid), { categories: updated }, { merge: true });
        } catch (e) { console.error('Save categories error:', e); }
    };

    const addCategory = () => {
        const name = newTag.trim();
        if (!name) return;
        if (categories.length >= 20) { setTagError('Maximum 20 categories allowed.'); return; }
        if (categories.some(c => c.toLowerCase() === name.toLowerCase())) { setTagError('Category already exists.'); return; }
        setTagError('');
        saveCategories([...categories, name]);
        setNewTag('');
    };

    const deleteCategory = (cat) => {
        saveCategories(categories.filter(c => c !== cat));
        if (filterCategory === cat) setFilterCategory('all');
    };

    const fetchTasks = async u => {
        if (!u) { setFetching(false); return; }
        setFetching(true);
        try {
            const q = query(collection(db, 'tasks'), where('uid', '==', u.uid));
            const snap = await getDocs(q);
            setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error('Fetch tasks error:', e); }
        finally { setFetching(false); }
    };

    useEffect(() => { fetchTasks(user); }, [user]);

    const openAdd = () => { setEditTask(null); setForm(EMPTY_FORM); setSaveError(''); setShowModal(true); };
    const openEdit = t => { setEditTask(t); setForm({ title: t.title, description: t.description || '', dueDate: t.dueDate || '', priority: t.priority || 'medium', category: t.category || 'Other' }); setSaveError(''); setShowModal(true); };

    const handleSave = async e => {
        e.preventDefault();
        if (!form.title.trim()) return;
        setLoading(true); setSaveError('');
        try {
            if (editTask) {
                await updateDoc(doc(db, 'tasks', editTask.id), {
                    title: form.title.trim(),
                    description: form.description.trim(),
                    dueDate: form.dueDate,
                    priority: form.priority,
                    category: form.category,
                });
                setTasks(prev => prev.map(t => t.id === editTask.id ? { ...t, ...form, title: form.title.trim(), description: form.description.trim() } : t));
            } else {
                const ref = await addDoc(collection(db, 'tasks'), {
                    uid: user.uid,
                    title: form.title.trim(),
                    description: form.description.trim(),
                    dueDate: form.dueDate,
                    priority: form.priority,
                    category: form.category,
                    completed: false,
                    createdAt: serverTimestamp(),
                });
                setTasks(prev => [{ id: ref.id, uid: user.uid, ...form, title: form.title.trim(), description: form.description.trim(), completed: false }, ...prev]);
            }
            setShowModal(false);
        } catch (e) {
            console.error('Save task error:', e);
            setSaveError(`Failed to save: ${e.message}. Check your Firestore rules.`);
        } finally { setLoading(false); }
    };

    const toggleComplete = async task => {
        const next = !task.completed;
        try {
            await updateDoc(doc(db, 'tasks', task.id), { completed: next });
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: next } : t));
        } catch (e) { console.error(e); }
    };

    const handleDelete = async id => {
        try {
            await deleteDoc(doc(db, 'tasks', id));
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch (e) { console.error(e); }
    };

    // Stats
    const active    = tasks.filter(t => !t.completed);
    const completed = tasks.filter(t => t.completed);
    const overdue   = active.filter(t => isOverdue(t.dueDate));
    const dueToday  = active.filter(t => daysLeft(t.dueDate) === 0);
    const pct       = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;

    // Filter + sort
    let displayed = tab === 'active' ? active : completed;
    if (filterPriority !== 'all') displayed = displayed.filter(t => t.priority === filterPriority);
    if (filterCategory !== 'all') displayed = displayed.filter(t => t.category === filterCategory);

    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
    if (sortBy === 'priority') displayed = [...displayed].sort((a,b) => (PRIORITY_ORDER[a.priority]||1) - (PRIORITY_ORDER[b.priority]||1));
    else if (sortBy === 'due') displayed = [...displayed].sort((a,b) => (a.dueDate||'9999') < (b.dueDate||'9999') ? -1 : 1);
    else displayed = [...displayed].sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

    return (
        <div className="app-shell">
            <Sidebar />
            <main className="main-content">

                {/* ── Header ── */}
                <div className="tasks-topbar">
                    <div>
                        <h1 className="tasks-heading">Task Manager</h1>
                        <p className="tasks-sub">Track assignments, deadlines and study goals</p>
                    </div>
                    <button className="tasks-add-btn" onClick={openAdd}>
                        <Plus size={17} /> New Task
                    </button>
                </div>

                {/* ── Stats row ── */}
                <div className="tasks-stats">
                    <div className="tstat" style={{ '--tc': '#86c9a8', '--tp': '#eef9f4' }}>
                        <div className="tstat-icon"><CheckCircle2 size={18}/></div>
                        <div className="tstat-body">
                            <div className="tstat-num">{completed.length}</div>
                            <div className="tstat-label">Completed</div>
                        </div>
                    </div>
                    <div className="tstat" style={{ '--tc': '#f59e0b', '--tp': '#fffbeb' }}>
                        <div className="tstat-icon"><Clock size={18}/></div>
                        <div className="tstat-body">
                            <div className="tstat-num">{active.length}</div>
                            <div className="tstat-label">Pending</div>
                        </div>
                    </div>
                    <div className="tstat" style={{ '--tc': '#ef4444', '--tp': '#fef2f2' }}>
                        <div className="tstat-icon"><AlertCircle size={18}/></div>
                        <div className="tstat-body">
                            <div className="tstat-num">{overdue.length}</div>
                            <div className="tstat-label">Overdue</div>
                        </div>
                    </div>
                    <div className="tstat tstat--progress" style={{ '--tc': '#8b5cf6', '--tp': '#f5f3ff' }}>
                        <div className="tstat-icon"><TrendingUp size={18}/></div>
                        <div className="tstat-body">
                            <div className="tstat-num">{pct}%</div>
                            <div className="tstat-label">Progress</div>
                        </div>
                        <div className="tstat-bar-wrap">
                            <div className="tstat-bar" style={{ width: `${pct}%` }}/>
                        </div>
                    </div>
                </div>

                {/* ── Due today banner ── */}
                {dueToday.length > 0 && (
                    <div className="due-today-banner">
                        <Clock size={16} color="#f59e0b"/>
                        <strong>{dueToday.length} task{dueToday.length > 1 ? 's' : ''} due today:</strong>
                        {dueToday.map(t => <span key={t.id} className="due-today-pill">{t.title}</span>)}
                    </div>
                )}

                {/* ── Tab + Sort + Filter row ── */}
                <div className="tasks-controls">
                    <div className="tasks-toggle">
                        <button className={`tasks-toggle-btn${tab === 'active' ? ' selected' : ''}`} onClick={() => setTab('active')}>
                            Active <span className="toggle-count">{active.length}</span>
                        </button>
                        <button className={`tasks-toggle-btn${tab === 'completed' ? ' selected' : ''}`} onClick={() => setTab('completed')}>
                            Completed <span className="toggle-count">{completed.length}</span>
                        </button>
                    </div>

                    <div className="tasks-right-controls">
                        <select className="tasks-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                            <option value="created">Sort: Newest</option>
                            <option value="due">Sort: Due Date</option>
                            <option value="priority">Sort: Priority</option>
                        </select>
                        <button className={`tasks-filter-btn${showFilters ? ' active' : ''}`} onClick={() => setShowFilters(f => !f)}>
                            <Filter size={14}/> Filter
                        </button>
                        <button className={`tasks-filter-btn${showTagManager ? ' active' : ''}`} onClick={() => setShowTagManager(v => !v)}>
                            <Settings size={14}/> Tags
                        </button>
                    </div>
                </div>

                {/* ── Filter chips ── */}
                {showFilters && (
                    <div className="tasks-filter-row">
                        <div className="filter-group">
                            <span className="filter-label">Priority:</span>
                            {['all','high','medium','low'].map(p => (
                                <button key={p} className={`filter-chip${filterPriority === p ? ' active' : ''}`} onClick={() => setFilterPriority(p)}>
                                    {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="filter-group">
                            <span className="filter-label">Category:</span>
                            {['all', ...categories].map(c => (
                                <button key={c} className={`filter-chip${filterCategory === c ? ' active' : ''}`} onClick={() => setFilterCategory(c)}>
                                    {c === 'all' ? 'All' : c}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Tag manager panel ── */}
                {showTagManager && (
                    <div className="tag-manager-panel">
                        <div className="tag-manager-header">
                            <div className="tag-manager-title">
                                <Tag size={15} /> Manage Categories
                            </div>
                            <span className="tag-manager-count">{categories.length}/20</span>
                        </div>
                        <div className="tag-manager-list">
                            {categories.map(cat => (
                                <span key={cat} className="tag-manager-pill">
                                    {cat}
                                    <button
                                        className="tag-manager-pill-x"
                                        onClick={() => deleteCategory(cat)}
                                        title={`Remove "${cat}"`}
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="tag-manager-add-row">
                            <input
                                className="tag-manager-input"
                                value={newTag}
                                onChange={e => { setNewTag(e.target.value); setTagError(''); }}
                                onKeyDown={e => e.key === 'Enter' && addCategory()}
                                placeholder="New category name..."
                                maxLength={24}
                            />
                            <button
                                className="tag-manager-add-btn"
                                onClick={addCategory}
                                disabled={!newTag.trim()}
                            >
                                <Plus size={14} /> Add
                            </button>
                        </div>
                        {tagError && <div className="tag-manager-error">{tagError}</div>}
                    </div>
                )}

                {/* ── Task list ── */}
                {fetching ? (
                    <div style={{ textAlign: 'center', padding: 60 }}>
                        <span className="spin" style={{ width: 28, height: 28, borderTopColor: '#86c9a8' }} />
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="empty-box">
                        <span className="empty-icon">{tab === 'active' ? '📋' : '🏆'}</span>
                        <p>{tab === 'active' ? 'No tasks here — click New Task to add one!' : 'No completed tasks yet. Keep going!'}</p>
                    </div>
                ) : (
                    <div className="tasks-list">
                        {displayed.map(task => {
                            const prio = PRIORITIES.find(p => p.value === (task.priority || 'medium'));
                            const overdueBool = !task.completed && isOverdue(task.dueDate);
                            return (
                                <div className={`task-item${task.completed ? ' done' : ''}${overdueBool ? ' overdue' : ''}`} key={task.id}>
                                    {/* Priority stripe */}
                                    <div className="task-priority-stripe" style={{ background: prio.color }} />

                                    {/* Circle toggle */}
                                    <button
                                        className={`task-circle${task.completed ? ' done' : ''}`}
                                        onClick={() => toggleComplete(task)}
                                        title={task.completed ? 'Mark active' : 'Mark done'}
                                    />

                                    {/* Content */}
                                    <div className="task-info">
                                        <div className="task-item-header">
                                            <div className={`task-item-title${task.completed ? ' struck' : ''}`}>{task.title}</div>
                                            <div className="task-tags">
                                                <span className="task-cat-badge">{task.category || 'Other'}</span>
                                                <span className="task-prio-badge" style={{ background: prio.bg, color: prio.color }}>
                                                    <Flag size={10}/> {prio.label}
                                                </span>
                                            </div>
                                        </div>
                                        {task.description && <div className="task-item-desc">{task.description}</div>}
                                        <DueBadge dueDate={task.dueDate} />
                                    </div>

                                    {/* Actions */}
                                    <div className="task-actions">
                                        <button className="task-action-btn edit" onClick={() => openEdit(task)} title="Edit">
                                            <Pencil size={15}/>
                                        </button>
                                        <button className="task-action-btn del" onClick={() => handleDelete(task.id)} title="Delete">
                                            <Trash2 size={15}/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* ── Modal ── */}
            {showModal && (
                <div className="modal-bg" onClick={() => setShowModal(false)}>
                    <div className="tasks-modal" onClick={e => e.stopPropagation()}>
                        <div className="tasks-modal-head">
                            <h2 className="tasks-modal-title">{editTask ? '✏️ Edit Task' : '✅ New Task'}</h2>
                            <button className="modal-close-btn" onClick={() => setShowModal(false)}><X size={16}/></button>
                        </div>
                        {saveError && <div className="tasks-save-error">{saveError}</div>}
                        <form onSubmit={handleSave}>
                            <div className="tasks-modal-field">
                                <label className="modal-label">Task Title *</label>
                                <input className="modal-input" placeholder="e.g. Submit Data Structures assignment"
                                    value={form.title} onChange={e => setForm({...form, title: e.target.value})} required autoFocus />
                            </div>
                            <div className="tasks-modal-field">
                                <label className="modal-label">Description</label>
                                <input className="modal-input" placeholder="Optional notes..."
                                    value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                            </div>
                            <div className="tasks-modal-row">
                                <div className="tasks-modal-field" style={{ flex: 1 }}>
                                    <label className="modal-label">Due Date</label>
                                    <input className="modal-input" type="date"
                                        value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
                                </div>
                                <div className="tasks-modal-field" style={{ flex: 1 }}>
                                    <label className="modal-label">Priority</label>
                                    <select className="modal-input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                                        {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="tasks-modal-field">
                                <label className="modal-label">Category</label>
                                <div className="tasks-cat-grid">
                                    {categories.map(c => (
                                        <button key={c} type="button"
                                            className={`tasks-cat-btn${form.category === c ? ' active' : ''}`}
                                            onClick={() => setForm({...form, category: c})}
                                        >{c}</button>
                                    ))}
                                </div>
                            </div>
                            <button type="submit" className="tasks-modal-create-btn" disabled={loading}>
                                {loading ? <span className="spin"/> : editTask ? 'Save Changes' : 'Create Task'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
