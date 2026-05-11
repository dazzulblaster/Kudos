import { createContext, useContext, useState, useEffect, useRef } from 'react';

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
    const [totalSec, setTotalSec] = useState(25 * 60); // default 25 min
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [running, setRunning]   = useState(false);
    const [visible, setVisible]   = useState(false); // floating widget visible?
    const [minimized, setMinimized] = useState(false);
    const intervalRef = useRef(null);

    // Tick
    useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => {
                setTimeLeft(s => {
                    if (s <= 1) {
                        clearInterval(intervalRef.current);
                        setRunning(false);
                        // Ding notification when done
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('Kudos Timer', { body: 'Focus session complete! Take a break. 🎉', icon: '/logo.svg' });
                        }
                        return 0;
                    }
                    return s - 1;
                });
            }, 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [running]);

    const start = (minutes) => {
        const secs = (minutes || Math.floor(totalSec / 60)) * 60;
        if (minutes) { setTotalSec(secs); setTimeLeft(secs); }
        setRunning(true);
        setVisible(true);
        setMinimized(false);
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };

    const pause  = () => setRunning(false);
    const resume = () => setRunning(true);
    const reset  = () => { setRunning(false); setTimeLeft(totalSec); };
    const stop   = () => { setRunning(false); setTimeLeft(totalSec); setVisible(false); };
    const setDuration = (minutes) => {
        const secs = minutes * 60;
        setTotalSec(secs);
        setTimeLeft(secs);
        setRunning(false);
    };

    const progress = totalSec > 0 ? ((totalSec - timeLeft) / totalSec) * 100 : 0;
    const pad = n => String(n).padStart(2, '0');
    const display = `${pad(Math.floor(timeLeft / 60))}:${pad(timeLeft % 60)}`;

    return (
        <TimerContext.Provider value={{
            totalSec, timeLeft, running, visible, minimized,
            progress, display,
            start, pause, resume, reset, stop, setDuration,
            setMinimized, setVisible,
        }}>
            {children}
        </TimerContext.Provider>
    );
}

export function useTimer() {
    const ctx = useContext(TimerContext);
    if (!ctx) throw new Error('useTimer must be used inside TimerProvider');
    return ctx;
}
