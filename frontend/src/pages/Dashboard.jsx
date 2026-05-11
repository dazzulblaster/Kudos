import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Sidebar from '../components/Sidebar';
import { useTimer } from '../context/TimerContext';
import {
    CheckCircle2, FileText, ArrowRight, Timer, Play, Pause,
    RotateCcw, Sparkles, BookOpen, FolderOpen, Brain, Zap,
    TrendingUp, Coffee, Target, MessageCircle
} from 'lucide-react';
import '../App.css';

const TIPS = [
    "Try the Pomodoro technique: 25 min focus, 5 min break! ⏱️",
    "Review your flashcards daily — spaced repetition boosts memory! 🧠",
    "Upload your lecture PDFs to let the AI quiz you on them! 📄",
    "Use the AI chatbot to explain difficult concepts simply! 💬",
    "Set tasks with deadlines to stay on track with your studies! ✅",
];

const QUICK_ACTIONS = [
    { label: 'My Library',   icon: FolderOpen,  color: '#86c9a8', bg: '#eef9f4', path: '/library' },
    { label: 'Tasks',        icon: CheckCircle2, color: '#f59e0b', bg: '#fffbeb', path: '/tasks' },
    { label: 'Kudos AI',     icon: Brain,        color: '#8b5cf6', bg: '#f5f3ff', path: '/chatbot' },
    { label: 'Study Notes',  icon: BookOpen,     color: '#3b82f6', bg: '#eff6ff', path: '/library' },
];

export default function Dashboard() {
    const navigate = useNavigate();
    const user = auth.currentUser;
    const [recentNotes, setRecentNotes] = useState([]);
    const [upcomingTasks, setUpcomingTasks] = useState([]);
    const [stats, setStats] = useState({ subjects: 0, files: 0, tasksDone: 0, pendingTasks: 0 });
    const [tipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));
    const [selectedMin, setSelectedMin] = useState(25);

    // Global timer from context
    const timer = useTimer();

    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            // Fetch each query independently so one failure doesn't zero out everything
            try {
                const nSnap = await getDocs(query(collection(db, 'notes'), where('uid','==',user.uid), orderBy('createdAt','desc'), limit(3)));
                setRecentNotes(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) { console.error('Dashboard: notes query failed:', e); }

            try {
                const tSnap = await getDocs(query(collection(db, 'tasks'), where('uid','==',user.uid), where('completed','==',false)));
                const allPending = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setUpcomingTasks(allPending.slice(0, 3)); // show max 3 in the overview card
                setStats(prev => ({ ...prev, pendingTasks: allPending.length }));
            } catch (e) { console.error('Dashboard: pending tasks query failed:', e); }

            try {
                const subSnap = await getDocs(query(collection(db, 'subjects'), where('uid','==',user.uid)));
                setStats(prev => ({ ...prev, subjects: subSnap.size }));
            } catch (e) { console.error('Dashboard: subjects query failed:', e); }

            try {
                const fileSnap = await getDocs(query(collection(db, 'files'), where('uid','==',user.uid)));
                setStats(prev => ({ ...prev, files: fileSnap.size }));
            } catch (e) { console.error('Dashboard: files query failed:', e); }

            try {
                const doneSnap = await getDocs(query(collection(db, 'tasks'), where('uid','==',user.uid), where('completed','==',true)));
                setStats(prev => ({ ...prev, tasksDone: doneSnap.size }));
            } catch (e) { console.error('Dashboard: completed tasks query failed:', e); }
        };
        fetchData();
    }, [user]);

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="app-shell">
            <Sidebar />
            <main className="main-content">

                {/* ── Top bar ── */}
                <div className="topbar">
                    <div className="topbar-left">
                        <h1>{greeting()}, {user?.displayName?.split(' ')[0] || 'Student'} 👋</h1>
                        <p>{today} · Let's make today productive!</p>
                    </div>
                    <div className="topbar-right">
                        <div className="topbar-tip">
                            <Coffee size={14} color="#f59e0b" />
                            <span>{TIPS[tipIdx]}</span>
                        </div>
                        <div className="topbar-avatar" title="Manage Account" onClick={() => navigate('/account')}>
                            <svg viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="8" r="4" fill="#fff" opacity="0.9"/>
                                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="#fff" opacity="0.9"/>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* ── Stats row ── */}
                <div className="stats-row">
                    <div className="stat-card" style={{ '--accent': '#86c9a8', '--accent-pale': '#eef9f4' }}>
                        <div className="stat-icon"><FolderOpen size={20} /></div>
                        <div className="stat-body">
                            <div className="stat-num">{stats.subjects}</div>
                            <div className="stat-label">Subjects</div>
                        </div>
                        <TrendingUp size={14} className="stat-trend" />
                    </div>
                    <div className="stat-card" style={{ '--accent': '#3b82f6', '--accent-pale': '#eff6ff' }}>
                        <div className="stat-icon"><FileText size={20} /></div>
                        <div className="stat-body">
                            <div className="stat-num">{stats.files}</div>
                            <div className="stat-label">PDF Files</div>
                        </div>
                        <TrendingUp size={14} className="stat-trend" />
                    </div>
                    <div className="stat-card" style={{ '--accent': '#f59e0b', '--accent-pale': '#fffbeb' }}>
                        <div className="stat-icon"><Target size={20} /></div>
                        <div className="stat-body">
                            <div className="stat-num">{stats.pendingTasks}</div>
                            <div className="stat-label">Pending Tasks</div>
                        </div>
                        <Zap size={14} className="stat-trend" />
                    </div>
                    <div className="stat-card" style={{ '--accent': '#8b5cf6', '--accent-pale': '#f5f3ff' }}>
                        <div className="stat-icon"><CheckCircle2 size={20} /></div>
                        <div className="stat-body">
                            <div className="stat-num">{stats.tasksDone}</div>
                            <div className="stat-label">Completed</div>
                        </div>
                        <TrendingUp size={14} className="stat-trend" />
                    </div>
                </div>

                {/* ── Quick actions ── */}
                <div className="section-label">Quick Actions</div>
                <div className="quick-actions-row">
                    {QUICK_ACTIONS.map(({ label, icon: Icon, color, bg, path }) => (
                        <button
                            key={label}
                            className="quick-action-btn"
                            style={{ '--qa-color': color, '--qa-bg': bg }}
                            onClick={() => navigate(path)}
                        >
                            <div className="qa-icon-wrap"><Icon size={20} color={color} /></div>
                            <span>{label}</span>
                        </button>
                    ))}
                </div>

                {/* ── Main grid ── */}
                <div className="section-label" style={{ marginTop: 28 }}>Overview</div>
                <div className="dashboard-grid">

                    {/* Upcoming Tasks */}
                    <div className="dash-card dash-card--amber">
                        <div className="dash-card-title">
                            <CheckCircle2 size={15} /> Pending Tasks
                        </div>
                        {upcomingTasks.length === 0
                            ? <div className="dash-card-empty">All caught up! 🎉</div>
                            : upcomingTasks.map(t => (
                                <div className="dash-card-item" key={t.id}>
                                    <CheckCircle2 size={13} opacity={0.7} />
                                    {t.title}
                                </div>
                            ))
                        }
                        <button className="dash-card-link" onClick={() => navigate('/tasks')}>
                            View all tasks <ArrowRight size={13} />
                        </button>
                    </div>

                    {/* Pomodoro Timer */}
                    <div className="focus-card">
                        <div className="focus-card-title"><Timer size={15} /> Pomodoro Timer</div>

                        {/* Duration picker */}
                        <div className="dash-duration-row">
                            {[5, 10, 15, 25, 45].map(m => (
                                <button
                                    key={m}
                                    className={`dash-dur-btn${selectedMin === m ? ' active' : ''}`}
                                    onClick={() => { setSelectedMin(m); timer.setDuration(m); }}
                                >
                                    {m}m
                                </button>
                            ))}
                        </div>

                        <div className="focus-timer-ring">
                            <svg width="90" height="90" viewBox="0 0 90 90">
                                <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6"/>
                                <circle cx="45" cy="45" r="38" fill="none" stroke="#fff" strokeWidth="6"
                                    strokeDasharray={`${2 * Math.PI * 38}`}
                                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - timer.progress / 100)}`}
                                    strokeLinecap="round"
                                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1s linear' }}
                                />
                            </svg>
                            <div className="focus-timer-overlay">
                                <div className="focus-timer-display">{timer.display}</div>
                            </div>
                        </div>
                        <div className="focus-timer-label">
                            {timer.running ? '🔥 Stay focused!' : timer.timeLeft === timer.totalSec ? `${selectedMin} min session` : `${Math.round(timer.progress)}% done`}
                        </div>
                        <div className="focus-btn-row">
                            <button
                                className={`focus-start-btn${timer.running ? ' paused' : ''}`}
                                onClick={() => timer.running ? timer.pause() : (timer.timeLeft === timer.totalSec ? timer.start(selectedMin) : timer.resume())}
                            >
                                {timer.running
                                    ? <><Pause size={13}/> Pause</>
                                    : timer.timeLeft === timer.totalSec
                                        ? <><Play size={13}/> Start</>
                                        : <><Play size={13}/> Resume</>}
                            </button>
                            {timer.timeLeft !== timer.totalSec && (
                                <button className="focus-start-btn paused" onClick={timer.reset}>
                                    <RotateCcw size={13}/> Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Recent Notes */}
                    <div className="dash-card dash-card--blue">
                        <div className="dash-card-title"><FileText size={15} /> Recent Notes</div>
                        {recentNotes.length === 0
                            ? <div className="dash-card-empty">No notes yet — start writing!</div>
                            : recentNotes.map(n => (
                                <div className="dash-card-item" key={n.id}>
                                    <FileText size={13} opacity={0.7} />
                                    {n.title}
                                </div>
                            ))
                        }
                        <button className="dash-card-link" onClick={() => navigate('/notes')}>
                            View all notes <ArrowRight size={13} />
                        </button>
                    </div>

                    {/* AI Feature Card */}
                    <div className="dash-card dash-card--purple">
                        <div className="dash-card-title"><Sparkles size={15} /> Kudos AI</div>
                        <div className="dash-card-empty" style={{ fontSize: '0.88rem', lineHeight: 1.7 }}>
                            Your AI study assistant is ready! Ask questions, generate flashcards, and quiz yourself on any topic. ✨
                        </div>
                        <button className="dash-card-link" onClick={() => navigate('/chatbot')}>
                            Start chatting <MessageCircle size={13} />
                        </button>
                    </div>

                </div>

                {/* FAB */}
                <button className="fab-ai" onClick={() => navigate('/chatbot')} title="Ask Kudos AI">
                    <Sparkles size={22} color="#fff" />
                </button>
            </main>
        </div>
    );
}
