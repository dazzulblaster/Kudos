import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import Register    from './pages/Register';
import Login       from './pages/Login';
import Dashboard   from './pages/Dashboard';
import Library     from './pages/Library';
import SubjectDetail from './pages/SubjectDetail';
import FileView    from './pages/FileView';
import Notes       from './pages/Notes';
import NoteEditor  from './pages/NoteEditor';
import Tasks       from './pages/Tasks';
import Chatbot     from './pages/Chatbot';
import Account     from './pages/Account';
import Admin       from './pages/Admin';

import { TimerProvider } from './context/TimerContext';
import FloatingTimer from './components/FloatingTimer';

// Protected Route wrapper
function PrivateRoute({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, u => setUser(u));
    return unsubscribe;
  }, []);

  if (user === undefined) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--page-bg)'
      }}>
        <span className="spin" style={{ width: 36, height: 36, borderTopColor: '#86c9a8' }} />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

// Admin route — checks admin status via backend API
function AdminRoute({ children }) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setStatus('denied'); return; }
      try {
        const token = await user.getIdToken();
        const res = await fetch('http://localhost:8000/auth/check-admin', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        setStatus(data.is_admin === true ? 'ok' : 'denied');
      } catch (err) {
        console.warn('AdminRoute: could not check admin status:', err);
        setStatus('denied');
      }
    });
    return unsub;
  }, []);

  if (status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)' }}>
        <span className="spin" style={{ width: 36, height: 36, borderTopColor: '#86c9a8' }} />
      </div>
    );
  }
  return status === 'ok' ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <TimerProvider>
      <BrowserRouter>
        {/* Global floating timer — renders on ALL pages when active */}
        <FloatingTimer />

        <Routes>
          <Route path="/"         element={<Navigate to="/login" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login"    element={<Login />} />

          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/library"   element={<PrivateRoute><Library /></PrivateRoute>} />
          <Route path="/library/:subjectId"                element={<PrivateRoute><SubjectDetail /></PrivateRoute>} />
          <Route path="/library/:subjectId/file/:fileId"  element={<PrivateRoute><FileView /></PrivateRoute>} />
          <Route path="/notes"     element={<PrivateRoute><Notes /></PrivateRoute>} />
          <Route path="/notes/:id" element={<PrivateRoute><NoteEditor /></PrivateRoute>} />
          <Route path="/tasks"     element={<PrivateRoute><Tasks /></PrivateRoute>} />
          <Route path="/chatbot"   element={<PrivateRoute><Chatbot /></PrivateRoute>} />
          <Route path="/account"   element={<PrivateRoute><Account /></PrivateRoute>} />
          <Route path="/admin"     element={<AdminRoute><Admin /></AdminRoute>} />
        </Routes>
      </BrowserRouter>
    </TimerProvider>
  );
}

export default App;
