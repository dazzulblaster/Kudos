import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    updateProfile, updatePassword,
    reauthenticateWithCredential, EmailAuthProvider,
    signOut
} from 'firebase/auth';
import { auth } from '../firebase';
import Sidebar from '../components/Sidebar';
import { User, Lock, LogOut, Check, X, Eye, EyeOff, Shield, Mail } from 'lucide-react';
import '../App.css';

export default function Account() {
    const navigate = useNavigate();
    const user = auth.currentUser;

    // Username state
    const [editingUsername, setEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState(user?.displayName || '');
    const [usernameLoading, setUsernameLoading] = useState(false);
    const [usernameMsg, setUsernameMsg] = useState(null);

    // Password state
    const [editingPassword, setEditingPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState(null);

    const initials = user?.displayName
        ? user.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : user?.email?.[0]?.toUpperCase() || '?';

    const handleSaveUsername = async () => {
        if (!newUsername.trim()) {
            setUsernameMsg({ type: 'error', text: 'Username cannot be empty.' });
            return;
        }
        setUsernameLoading(true);
        setUsernameMsg(null);
        try {
            await updateProfile(user, { displayName: newUsername.trim() });
            setUsernameMsg({ type: 'success', text: 'Username updated successfully!' });
            setEditingUsername(false);
        } catch (e) {
            setUsernameMsg({ type: 'error', text: 'Failed to update username. Please try again.' });
        } finally {
            setUsernameLoading(false);
        }
    };

    const cancelUsername = () => {
        setEditingUsername(false);
        setNewUsername(user?.displayName || '');
        setUsernameMsg(null);
    };

    const handleSavePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordMsg({ type: 'error', text: 'Please fill in all fields.' });
            return;
        }
        if (newPassword.length < 6) {
            setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
            return;
        }
        if (newPassword === currentPassword) {
            setPasswordMsg({ type: 'error', text: 'New password must differ from current password.' });
            return;
        }
        setPasswordLoading(true);
        setPasswordMsg(null);
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
            setEditingPassword(false);
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (e) {
            if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
                setPasswordMsg({ type: 'error', text: 'Current password is incorrect.' });
            } else if (e.code === 'auth/too-many-requests') {
                setPasswordMsg({ type: 'error', text: 'Too many attempts. Please try again later.' });
            } else {
                setPasswordMsg({ type: 'error', text: 'Failed to update password. Please try again.' });
            }
        } finally {
            setPasswordLoading(false);
        }
    };

    const cancelPassword = () => {
        setEditingPassword(false);
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        setPasswordMsg(null);
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <main className="main-content">

                <div className="page-top-bar">
                    <div>
                        <div className="page-heading">Account</div>
                        <div className="page-sub">Manage your profile and security settings</div>
                    </div>
                </div>

                <div className="account-wrap">

                    {/* ── Profile card ── */}
                    <div className="account-profile-card">
                        <div className="account-avatar">{initials}</div>
                        <div className="account-profile-info">
                            <div className="account-profile-name">
                                {user?.displayName || 'Student'}
                            </div>
                            <div className="account-profile-email">
                                <Mail size={13} />
                                {user?.email}
                            </div>
                        </div>
                        <button className="account-logout-btn" onClick={handleLogout}>
                            <LogOut size={15} />
                            Logout
                        </button>
                    </div>

                    {/* ── Profile information ── */}
                    <div className="account-section-card">
                        <div className="account-section-title">
                            <User size={16} />
                            Profile Information
                        </div>

                        <div className="account-fields-row">

                            {/* Username */}
                            <div className="account-field-group">
                                <label className="account-field-label">Username</label>

                                {editingUsername ? (
                                    <div className="account-edit-block">
                                        <input
                                            className="account-field-input"
                                            value={newUsername}
                                            onChange={e => setNewUsername(e.target.value)}
                                            placeholder="Enter new username"
                                            autoFocus
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleSaveUsername();
                                                if (e.key === 'Escape') cancelUsername();
                                            }}
                                        />
                                        <div className="account-btn-row">
                                            <button
                                                className="account-action-btn save"
                                                onClick={handleSaveUsername}
                                                disabled={usernameLoading}
                                            >
                                                {usernameLoading
                                                    ? <span className="spin" style={{ width: 13, height: 13, borderWidth: 2 }} />
                                                    : <><Check size={13} /> Save</>
                                                }
                                            </button>
                                            <button className="account-action-btn cancel" onClick={cancelUsername}>
                                                <X size={13} /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="account-field-display">
                                        <div className="account-field-value">
                                            {user?.displayName || '—'}
                                        </div>
                                        <button
                                            className="account-change-link"
                                            onClick={() => { setEditingUsername(true); setUsernameMsg(null); }}
                                        >
                                            Change Username
                                        </button>
                                    </div>
                                )}

                                {usernameMsg && (
                                    <div className={`account-msg ${usernameMsg.type}`}>
                                        {usernameMsg.type === 'success' ? <Check size={13} /> : <X size={13} />}
                                        {usernameMsg.text}
                                    </div>
                                )}
                            </div>

                            {/* Password */}
                            <div className="account-field-group">
                                <label className="account-field-label">Password</label>

                                {editingPassword ? (
                                    <div className="account-edit-block">
                                        <div className="account-pw-wrap">
                                            <input
                                                className="account-field-input"
                                                type={showCurrent ? 'text' : 'password'}
                                                placeholder="Current password"
                                                value={currentPassword}
                                                onChange={e => setCurrentPassword(e.target.value)}
                                            />
                                            <button
                                                className="account-eye-btn"
                                                onClick={() => setShowCurrent(v => !v)}
                                                tabIndex={-1}
                                                type="button"
                                            >
                                                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                        <div className="account-pw-wrap">
                                            <input
                                                className="account-field-input"
                                                type={showNew ? 'text' : 'password'}
                                                placeholder="New password"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                            />
                                            <button
                                                className="account-eye-btn"
                                                onClick={() => setShowNew(v => !v)}
                                                tabIndex={-1}
                                                type="button"
                                            >
                                                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                        <div className="account-pw-wrap">
                                            <input
                                                className="account-field-input"
                                                type={showConfirm ? 'text' : 'password'}
                                                placeholder="Confirm new password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSavePassword();
                                                    if (e.key === 'Escape') cancelPassword();
                                                }}
                                            />
                                            <button
                                                className="account-eye-btn"
                                                onClick={() => setShowConfirm(v => !v)}
                                                tabIndex={-1}
                                                type="button"
                                            >
                                                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                        <div className="account-btn-row">
                                            <button
                                                className="account-action-btn save"
                                                onClick={handleSavePassword}
                                                disabled={passwordLoading}
                                            >
                                                {passwordLoading
                                                    ? <span className="spin" style={{ width: 13, height: 13, borderWidth: 2 }} />
                                                    : <><Shield size={13} /> Update Password</>
                                                }
                                            </button>
                                            <button className="account-action-btn cancel" onClick={cancelPassword}>
                                                <X size={13} /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="account-field-display">
                                        <div className="account-field-value account-field-dots">
                                            ••••••••••
                                        </div>
                                        <button
                                            className="account-change-link"
                                            onClick={() => { setEditingPassword(true); setPasswordMsg(null); }}
                                        >
                                            Change Password
                                        </button>
                                    </div>
                                )}

                                {passwordMsg && (
                                    <div className={`account-msg ${passwordMsg.type}`}>
                                        {passwordMsg.type === 'success' ? <Check size={13} /> : <X size={13} />}
                                        {passwordMsg.text}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* ── Email (read-only info) ── */}
                    <div className="account-section-card">
                        <div className="account-section-title">
                            <Lock size={16} />
                            Account Details
                        </div>
                        <div className="account-detail-row">
                            <span className="account-detail-label">Email address</span>
                            <span className="account-detail-value">{user?.email}</span>
                            <span className="account-detail-badge">Cannot be changed</span>
                        </div>
                        <div className="account-detail-row">
                            <span className="account-detail-label">Sign-in method</span>
                            <span className="account-detail-value">Email &amp; Password</span>
                            <span className="account-detail-badge">Firebase Auth</span>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
