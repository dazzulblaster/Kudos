import { useState } from 'react';
import { useTimer } from '../context/TimerContext';
import { Play, Pause, RotateCcw, X, ChevronDown, ChevronUp, Timer } from 'lucide-react';
import './FloatingTimer.css';

const PRESETS = [5, 10, 15, 20, 25, 30, 45, 60];

export default function FloatingTimer() {
    const { display, running, visible, minimized, progress, totalSec, timeLeft,
            pause, resume, reset, stop, setMinimized, setDuration, start } = useTimer();
    const [showPresets, setShowPresets] = useState(false);
    const [customMin, setCustomMin] = useState('');

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
        <div className={`ft-widget${minimized ? ' ft-minimized' : ''}${isComplete ? ' ft-done' : ''}`}>

            {/* Top bar */}
            <div className="ft-topbar">
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
