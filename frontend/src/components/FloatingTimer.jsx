import { useState, useRef, useEffect, useCallback } from 'react';
import { useTimer } from '../context/TimerContext';
import { Play, Pause, RotateCcw, X, ChevronDown, ChevronUp, Timer } from 'lucide-react';
import './FloatingTimer.css';

const PRESETS = [5, 10, 15, 20, 25, 30, 45, 60];

const STORAGE_KEY = 'ft-position';

function loadPos() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return null;
}

export default function FloatingTimer() {
    const { display, running, visible, minimized, progress, totalSec, timeLeft,
            pause, resume, reset, stop, setMinimized, setDuration, start } = useTimer();
    const [showPresets, setShowPresets] = useState(false);
    const [customMin, setCustomMin] = useState('');

    // --- Drag state ---
    const widgetRef = useRef(null);
    const dragging  = useRef(false);
    const dragStart = useRef({ mouseX: 0, mouseY: 0, elX: 0, elY: 0 });
    const [pos, setPos] = useState(loadPos); // null = use CSS default
    const [isDragging, setIsDragging] = useState(false);

    const savePos = useCallback((p) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
    }, []);

    const onMouseDown = useCallback((e) => {
        // Only trigger on left-click, ignore buttons inside topbar
        if (e.button !== 0) return;
        if (e.target.closest('button')) return;
        e.preventDefault();
        const rect = widgetRef.current.getBoundingClientRect();
        dragging.current = true;
        setIsDragging(true);
        dragStart.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            elX: rect.left,
            elY: rect.top,
        };
    }, []);

    useEffect(() => {
        const onMove = (e) => {
            if (!dragging.current) return;
            const dx = e.clientX - dragStart.current.mouseX;
            const dy = e.clientY - dragStart.current.mouseY;
            const newX = dragStart.current.elX + dx;
            const newY = dragStart.current.elY + dy;
            // Clamp to viewport
            const el = widgetRef.current;
            const maxX = window.innerWidth  - (el ? el.offsetWidth  : 200);
            const maxY = window.innerHeight - (el ? el.offsetHeight : 100);
            const clampedX = Math.max(0, Math.min(newX, maxX));
            const clampedY = Math.max(0, Math.min(newY, maxY));
            setPos({ x: clampedX, y: clampedY });
        };
        const onUp = (e) => {
            if (!dragging.current) return;
            dragging.current = false;
            setIsDragging(false);
            // Persist final position
            setPos(prev => { if (prev) savePos(prev); return prev; });
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [savePos]);

    // Inline style: use saved pos if available, otherwise fall back to CSS
    const posStyle = pos
        ? { top: pos.y, left: pos.x, bottom: 'auto', right: 'auto' }
        : {};


    if (!visible) return null;

    const totalMin = Math.floor(totalSec / 60);
    const isComplete = timeLeft === 0;

    const handleCustom = (e) => {
        e.preventDefault();
        const m = parseInt(customMin, 10);
        if (m > 0 && m <= 180) { setDuration(m); setCustomMin(''); setShowPresets(false); }
    };

    // SVG ring
    const RADIUS = 28;
    const CIRC   = 2 * Math.PI * RADIUS;
    const dash   = CIRC * (1 - progress / 100);

    return (
        <div
            ref={widgetRef}
            className={`ft-widget${minimized ? ' ft-minimized' : ''}${isComplete ? ' ft-done' : ''}${isDragging ? ' ft-dragging' : ''}`}
            style={posStyle}
        >

            {/* Top bar — drag handle */}
            <div className="ft-topbar" onMouseDown={onMouseDown} title="Drag to move">
                <span className="ft-label">
                    <Timer size={13} /> Focus Timer
                </span>
                <div className="ft-top-actions">
                    <button className="ft-icon-btn" title={minimized ? 'Expand' : 'Minimize'} onClick={() => setMinimized(m => !m)}>
                        {minimized ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                    </button>
                    <button className="ft-icon-btn close" title="Stop timer" onClick={stop}>
                        <X size={13}/>
                    </button>
                </div>
            </div>

            {!minimized && (
                <>
                    {/* Ring + time */}
                    <div className="ft-ring-wrap">
                        <svg width="72" height="72" viewBox="0 0 72 72">
                            <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="5"/>
                            <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="#fff" strokeWidth="5"
                                strokeDasharray={CIRC}
                                strokeDashoffset={dash}
                                strokeLinecap="round"
                                style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1s linear' }}
                            />
                        </svg>
                        <div className="ft-time-overlay">
                            <div className="ft-time">{display}</div>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="ft-status">
                        {isComplete ? '🎉 Done!' : running ? '🔥 Focused' : `${totalMin} min session`}
                    </div>

                    {/* Controls */}
                    <div className="ft-controls">
                        {!isComplete && (
                            <button className="ft-ctrl-btn primary" onClick={running ? pause : resume}>
                                {running ? <><Pause size={13}/> Pause</> : <><Play size={13}/> {timeLeft < totalSec ? 'Resume' : 'Start'}</>}
                            </button>
                        )}
                        <button className="ft-ctrl-btn" onClick={reset} title="Reset">
                            <RotateCcw size={13}/>
                        </button>
                    </div>

                    {/* Duration picker */}
                    <button className="ft-change-btn" onClick={() => setShowPresets(s => !s)}>
                        Change duration ▾
                    </button>

                    {showPresets && (
                        <div className="ft-presets">
                            <div className="ft-preset-grid">
                                {PRESETS.map(m => (
                                    <button
                                        key={m}
                                        className={`ft-preset${totalMin === m ? ' active' : ''}`}
                                        onClick={() => { setDuration(m); setShowPresets(false); }}
                                    >
                                        {m}m
                                    </button>
                                ))}
                            </div>
                            <form className="ft-custom-row" onSubmit={handleCustom}>
                                <input
                                    type="number" min="1" max="180" placeholder="Custom min"
                                    className="ft-custom-input"
                                    value={customMin}
                                    onChange={e => setCustomMin(e.target.value)}
                                />
                                <button type="submit" className="ft-custom-set">Set</button>
                            </form>
                        </div>
                    )}
                </>
            )}

            {/* Minimized: just show time */}
            {minimized && (
                <div className="ft-mini-time">{display}</div>
            )}
        </div>
    );
}
