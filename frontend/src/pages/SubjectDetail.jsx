import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
    doc, getDoc, collection, addDoc, getDocs,
    deleteDoc, query, where, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import Sidebar from '../components/Sidebar';
import { ArrowLeft, Upload, FileText, Trash2, ArrowRight, ChevronRight } from 'lucide-react';
import '../App.css';
import './SubjectDetail.css';

const BACKEND = 'http://localhost:8000';

export default function SubjectDetail() {
    const { subjectId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [subject, setSubject] = useState(null);
    const [files, setFiles] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => setUser(u));
        return unsub;
    }, []);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            setFetching(true);
            try {
                // Load subject metadata
                const snap = await getDoc(doc(db, 'subjects', subjectId));
                if (snap.exists()) setSubject({ id: snap.id, ...snap.data() });

                // Load files for this subject
                const q = query(
                    collection(db, 'files'),
                    where('subjectId', '==', subjectId),
                    where('uid', '==', user.uid)
                );
                const fsnap = await getDocs(q);
                const list = fsnap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0));
                setFiles(list);
            } catch (e) { console.error(e); }
            finally { setFetching(false); }
        };
        load();
    }, [user, subjectId]);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !file.name.endsWith('.pdf')) {
            alert('Please upload a PDF file.');
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        try {
            const storageRef = ref(storage, `files/${user.uid}/${subjectId}/${Date.now()}_${file.name}`);
            const task = uploadBytesResumable(storageRef, file);

            await new Promise((resolve, reject) => {
                task.on('state_changed',
                    snap => setUploadProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
                    reject,
                    resolve
                );
            });

            const downloadURL = await getDownloadURL(storageRef);

            // Extract text via backend
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${BACKEND}/extract-text`, { method: 'POST', body: formData });
            const { text } = await res.json();

            // Save file metadata to Firestore
            const docRef = await addDoc(collection(db, 'files'), {
                uid: user.uid,
                subjectId,
                name: file.name,
                downloadURL,
                storagePath: storageRef.fullPath,
                extractedText: text || '',
                uploadedAt: serverTimestamp(),
            });

            setFiles(prev => [{
                id: docRef.id,
                name: file.name,
                downloadURL,
                extractedText: text || '',
            }, ...prev]);
        } catch (err) {
            console.error('Upload error:', err);
            alert('Upload failed. Please try again.');
        } finally {
            setUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (file) => {
        if (!confirm(`Delete "${file.name}"?`)) return;
        try {
            if (file.storagePath) await deleteObject(ref(storage, file.storagePath));
            await deleteDoc(doc(db, 'files', file.id));
            setFiles(prev => prev.filter(f => f.id !== file.id));
        } catch (e) { console.error(e); }
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <main className="main-content">
                {/* Top bar */}
                <div className="page-top-bar">
                    <div className="sd-breadcrumb">
                        <button className="sd-back-btn" onClick={() => navigate('/library')}>
                            <ArrowLeft size={15} /> Library
                        </button>
                        <ChevronRight size={16} className="sd-breadcrumb-sep" color="#d1d5db" />
                        <span className="sd-title">{subject?.name || '...'}</span>
                    </div>
                    <div className="sd-upload-area">
                        {uploading ? (
                            <div className="sd-progress-bar-wrap">
                                <div className="sd-progress-bar" style={{ width: `${uploadProgress}%` }} />
                                <span>⬆ {uploadProgress}% uploading...</span>
                            </div>
                        ) : (
                            <button className="sd-upload-btn" onClick={() => fileInputRef.current.click()}>
                                <Upload size={16} /> Upload PDF
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            style={{ display: 'none' }}
                            onChange={handleUpload}
                        />
                    </div>
                </div>

                {/* File list */}
                {fetching ? (
                    <div style={{ textAlign: 'center', padding: 60 }}>
                        <span className="spin" style={{ width: 30, height: 30, borderTopColor: '#86c9a8' }} />
                    </div>
                ) : files.length === 0 ? (
                    <div className="empty-box">
                        <div className="empty-icon">📄</div>
                        <p>No files yet — click <strong>Upload PDF</strong> to get started!</p>
                    </div>
                ) : (
                    <div className="sd-file-list">
                        {files.map(file => (
                            <div
                                key={file.id}
                                className="sd-file-card"
                                onClick={() => navigate(`/library/${subjectId}/file/${file.id}`)}
                            >
                                <div className="sd-file-icon-wrap">
                                    <FileText size={24} />
                                </div>
                                <div className="sd-file-info">
                                    <div className="sd-file-name">{file.name}</div>
                                    <div className="sd-file-meta">
                                        <span>PDF</span>
                                        <span className="sd-file-meta-dot" />
                                        <span>
                                            {file.extractedText
                                                ? `${Math.ceil(file.extractedText.length / 1000)}k chars`
                                                : 'Processing...'}
                                        </span>
                                    </div>
                                </div>
                                <div className="sd-file-actions">
                                    <span className="sd-open-badge">Study <ArrowRight size={12} /></span>
                                    <button
                                        className="sd-delete-btn"
                                        onClick={e => { e.stopPropagation(); handleDelete(file); }}
                                        title="Delete file"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
