# Kudos — Changes & Setup Guide

## Quick Start

```bash
# Terminal 1 — Backend
cd C:\Users\IM11\Desktop\Kudos\backend
py -m uvicorn main:app --reload

# Terminal 2 — Frontend
cd C:\Users\IM11\Desktop\Kudos\frontend
npm run dev
```

---

## Overview of Changes Made

The following features were added to the Kudos study platform:

1. **Account Page** — users can change their username and password

### Removed Features

The following features were built but later removed to keep the system clean:

- **Admin Module** — admin dashboard to manage all users (removed: not needed for the FYP scope)
- **Notes Module** — standalone markdown notes page with auto-save editor (removed: redundant with the Library's study tools)

---

## Files Modified / Created

### Frontend

| File | Change |
|------|--------|
| `frontend/src/pages/Account.jsx` | **Created** — account management page |
| `frontend/src/pages/Register.jsx` | **Modified** — saves user to Firestore `users` collection on signup |
| `frontend/src/App.jsx` | **Modified** — added `/account` route |
| `frontend/src/components/Sidebar.jsx` | **Modified** — added Account nav item with icon |
| `frontend/src/pages/Dashboard.jsx` | **Modified** — avatar button navigates to `/account` |
| `frontend/src/App.css` | **Modified** — added Account page styles |

### Backend

| File | Change |
|------|--------|
| `backend/main.py` | **Modified** — added model fallback chains, fixed `/chat` bug |
| `backend/requirements.txt` | **Modified** — added `PyMuPDF`, `python-multipart` |
| `backend/.gitignore` | **Created** — excludes `__pycache__`, `.env` |

---

## What Each Feature Does

### Account Page (`/account`)
- View profile (avatar with initials, email, join date)
- Change username — inline edit, saves to Firebase Auth `displayName` and Firestore `users/{uid}`
- Change password — requires current password for re-authentication, then updates via Firebase Auth
- Password fields have show/hide eye toggle

---

## Running the App

### Backend
```bash
cd C:\Users\IM11\Desktop\Kudos\backend
py -m uvicorn main:app --reload
```
Backend runs at: `http://localhost:8000`

### Frontend
```bash
cd C:\Users\IM11\Desktop\Kudos\frontend
npm run dev
```
Frontend runs at: `http://localhost:5173`

---

## Known Limitations

- No chat history persistence — conversation resets on page refresh
- Backend URL is hardcoded as `http://localhost:8000` in each frontend component
- Study tab notes in FileView are stored in React state only — lost on page reload
