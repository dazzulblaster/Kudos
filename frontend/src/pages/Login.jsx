import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import './Login.css';

const BACKEND = 'http://localhost:8000';

export default function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await signInWithEmailAndPassword(auth, form.email, form.password);
            console.log('[Login] User UID:', result.user.uid);

            // Check admin status via backend (bypasses Firestore security rules)
            let isAdmin = false;
            try {
                const token = await result.user.getIdToken();
                const res = await fetch(`${BACKEND}/auth/check-admin`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                isAdmin = data.is_admin === true;
                console.log('[Login] Admin check result:', data);
            } catch (apiErr) {
                console.warn('Could not check admin status:', apiErr);
            }

            navigate(isAdmin ? '/admin' : '/dashboard');
        } catch (err) {
            console.error('Login error:', err.code, err.message);
            if (
                err.code === 'auth/user-not-found' ||
                err.code === 'auth/wrong-password' ||
                err.code === 'auth/invalid-credential'
            )
                setError('Invalid email or password. Please try again.');
            else if (err.code === 'auth/too-many-requests')
                setError('Too many attempts. Please try again later.');
            else
                setError('Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-bg">
            <div className="login-card">
                {/* Avatar */}
                <div className="login-avatar">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="8" r="4" fill="#8bb8b0" />
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="#8bb8b0" />
                    </svg>
                </div>

                <h1 className="login-title">Sign in</h1>
                <p className="login-subtitle">Sign in to get started</p>

                {error && <div className="login-error">⚠️ {error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="login-field">
                        <label className="login-label">Email Address</label>
                        <input
                            id="login-email"
                            name="email"
                            type="email"
                            className="login-input"
                            value={form.email}
                            onChange={handleChange}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="login-field">
                        <label className="login-label">Password</label>
                        <input
                            id="login-password"
                            name="password"
                            type="password"
                            className="login-input"
                            value={form.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button id="login-submit" type="submit" className="login-btn" disabled={loading}>
                        {loading ? <span className="login-spinner" /> : 'Sign in'}
                    </button>
                </form>

                <p className="login-footer">
                    Don&apos;t have an account? <Link to="/register">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
