import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './NoteEditor.css';

export default function NoteEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [note, setNote] = useState(null);
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(true);
    const saveTimeout = useRef(null);
    const textareaRef = useRef(null);

    // Load note from Firestore
    useEffect(() => {
        const fetchNote = async () => {
            try {
                const snap = await getDoc(doc(db, 'notes', id));
                if (snap.exists()) {
                    const data = snap.data();
                    setNote(data);
                    setTitle(data.title || '');
                    setContent(data.content || '');
                }
            } catch (e) { console.error(e); }
        };
        fetchNote();
    }, [id]);

    // Auto-save with debounce
    const autoSave = useCallback(async (newTitle, newContent) => {
        clearTimeout(saveTimeout.current);
        setSaved(false);
        saveTimeout.current = setTimeout(async () => {
            setSaving(true);
            try {
                await updateDoc(doc(db, 'notes', id), {
                    title: newTitle,
                    content: newContent,
                });
                setSaved(true);
            } catch (e) { console.error(e); }
            finally { setSaving(false); }
        }, 1000);
    }, [id]);

    const handleTitleChange = (e) => {
        setTitle(e.target.value);
        autoSave(e.target.value, content);
    };

    const handleContentChange = (e) => {
        setContent(e.target.value);
        autoSave(title, e.target.value);
    };

    // Markdown toolbar helpers
    const insertMarkdown = (before, after = '', placeholder = 'text') => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const selected = content.substring(start, end) || placeholder;
        const newText = content.substring(0, start) + before + selected + after + content.substring(end);
        setContent(newText);
        autoSave(title, newText);
        setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + before.length, start + before.length + selected.length);
        }, 0);
    };

    const TOOLBAR = [
        { label: 'H1', action: () => insertMarkdown('# ', '', 'Heading 1'), title: 'Heading 1' },
        { label: 'H2', action: () => insertMarkdown('## ', '', 'Heading 2'), title: 'Heading 2' },
        { label: 'H3', action: () => insertMarkdown('### ', '', 'Heading 3'), title: 'Heading 3' },
        { label: '|', divider: true },
        { label: 'B', action: () => insertMarkdown('**', '**', 'bold'), title: 'Bold', style: { fontWeight: 'bold' } },
        { label: 'I', action: () => insertMarkdown('*', '*', 'italic'), title: 'Italic', style: { fontStyle: 'italic' } },
        { label: '~~', action: () => insertMarkdown('~~', '~~', 'strikethrough'), title: 'Strikethrough' },
        { label: '`', action: () => insertMarkdown('`', '`', 'code'), title: 'Inline Code' },
        { label: '|', divider: true },
        { label: '• List', action: () => insertMarkdown('\n- ', '', 'item'), title: 'Bullet List' },
        { label: '1. List', action: () => insertMarkdown('\n1. ', '', 'item'), title: 'Numbered List' },
        { label: '[ ] Todo', action: () => insertMarkdown('\n- [ ] ', '', 'Task'), title: 'Todo' },
        { label: '|', divider: true },
        { label: '> Quote', action: () => insertMarkdown('\n> ', '', 'quote'), title: 'Blockquote' },
        { label: '— Line', action: () => insertMarkdown('\n\n---\n\n', ''), title: 'Divider' },
    ];

    if (!note) {
        return (
            <div className="ne-loading">
                <div className="ne-spinner" />
            </div>
        );
    }

    return (
        <div className="ne-page">
            {/* Top Bar */}
            <div className="ne-topbar">
                <button className="ne-back" onClick={() => navigate('/notes')}>
                    ← My Notes
                </button>
                <div className="ne-breadcrumb">My Notes › <span>{title || 'Untitled'}</span></div>
                <div className="ne-save-status">
                    {saving ? '💾 Saving...' : saved ? '✅ Saved' : '✏️ Unsaved'}
                </div>
                <button
                    className={`ne-mode-btn ${editing ? 'active' : ''}`}
                    onClick={() => setEditing(e => !e)}
                >
                    {editing ? '👁 Preview' : '✏️ Edit'}
                </button>
            </div>

            <div className="ne-body">
                {/* Toolbar (only in edit mode) */}
                {editing && (
                    <div className="ne-toolbar">
                        {TOOLBAR.map((t, i) =>
                            t.divider ? (
                                <span key={i} className="ne-toolbar-divider" />
                            ) : (
                                <button
                                    key={i}
                                    className="ne-toolbar-btn"
                                    onClick={t.action}
                                    title={t.title}
                                    style={t.style}
                                >
                                    {t.label}
                                </button>
                            )
                        )}
                    </div>
                )}

                {/* Content area */}
                <div className="ne-content">
                    {/* Title */}
                    {editing ? (
                        <input
                            className="ne-title-input"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder="Note title..."
                        />
                    ) : (
                        <h1 className="ne-title-view">{title || 'Untitled'}</h1>
                    )}

                    {/* Body */}
                    {editing ? (
                        <textarea
                            ref={textareaRef}
                            className="ne-textarea"
                            value={content}
                            onChange={handleContentChange}
                            placeholder={`Start writing your note here...\n\nTips:\n# Heading 1\n## Heading 2\n- Bullet point\n1. Numbered list\n**bold** *italic*\n> Blockquote\n\`\`\`code block\`\`\``}
                            spellCheck
                        />
                    ) : (
                        <div className="ne-preview" onClick={() => setEditing(true)}>
                            {content ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {content}
                                </ReactMarkdown>
                            ) : (
                                <p className="ne-empty-hint">Click <strong>✏️ Edit</strong> to start writing your note...</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
