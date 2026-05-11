import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import './Register.css';

export default function Register() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.username.trim()) return setError('Please enter a username.');
        if (form.password.length < 6) return setError('Password must be at least 6 characters.');
        if (form.password !== form.confirm) return setError('Passwords do not match.');

        setLoading(true);
        try {
            const result = await createUserWithEmailAndPassword(auth, form.email, form.password);
            await updateProfile(result.user, { displayName: form.username });

            // Save user to Firestore — wrapped separately so a permission
            // error doesn't block the entire registration (Auth already succeeded)
            try {
                await setDoc(doc(db, 'users', result.user.uid), {
                    uid: result.user.uid,
                    username: form.username,
                    email: form.email,
                    createdAt: serverTimestamp(),
                });
            } catch (firestoreErr) {
                console.warn('Could not save user to Firestore (security rules may be blocking writes):', firestoreErr);
            }

            navigate('/dashboard');
        } catch (err) {
            console.error('Registration error:', err.code, err.message);
            if (err.code === 'auth/email-already-in-use') setError('This email is already registered.');
            else if (err.code === 'auth/invalid-email') setError('Please enter a valid email address.');
            else setError('Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="reg-bg">
            <div className="reg-card">
                {/* Avatar */}
                <div className="reg-avatar">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="8" r="4" fill="#8bb8b0" />
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="#8bb8b0" />
                    </svg>
                </div>

                <h1 className="reg-title">Create Account</h1>
                <p className="reg-subtitle">Sign up to get started</p>

                {error && <div className="reg-error">⚠️ {error}</div>}

                <form onSubmit={handleSubmit} className="reg-form">
                    <div className="reg-field">
                        <label className="reg-label">Email Address</label>
                        <input
                            id="reg-email"
                            name="email"
                            type="email"
                            className="reg-input"
                            value={form.email}
                            onChange={handleChange}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="reg-field">
                        <label className="reg-label">Username</label>
                        <input
                            id="reg-username"
                            name="username"
                            type="text"
                            className="reg-input"
                            value={form.username}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="reg-field">
                        <label className="reg-label">Password</label>
                        <input
                            id="reg-password"
                            name="password"
                            type="password"
                            className="reg-input"
                            value={form.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="reg-field">
                        <label className="reg-label">Confirm Password</label>
                        <input
                            id="reg-confirm"
                            name="confirm"
                            type="password"
                            className="reg-input"
                            value={form.confirm}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button id="reg-submit" type="submit" className="reg-btn" disabled={loading}>
                        {loading ? <span className="reg-spinner" /> : 'Create Account'}
                    </button>
                </form>

                <p className="reg-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
