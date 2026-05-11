cd C:\Users\IM11\Desktop\Kudos\frontend
npm run dev

C:\Users\IM11\Desktop\Kudos\backend
py -m uvicorn main:app --reload


# Kudos — Changes & Setup Guide

## Overview of Changes Made

Two major features were added to the Kudos study platform:
1. **Account Page** — users can change their username and password
2. **Admin Module** — admin dashboard to manage all users

---

## Files Modified / Created

### Frontend

| File | Change |
|------|--------|
| `frontend/src/pages/Account.jsx` | **Created** — account management page |
| `frontend/src/pages/Admin.jsx` | **Created** — admin dashboard page |
| `frontend/src/pages/Register.jsx` | **Modified** — saves user to Firestore `users` collection on signup |
| `frontend/src/pages/Login.jsx` | **Modified** — checks `admins` collection and redirects admin to `/admin` |
| `frontend/src/App.jsx` | **Modified** — added `AdminRoute` guard, `/account` and `/admin` routes |
| `frontend/src/components/Sidebar.jsx` | **Modified** — added Account nav item with icon |
| `frontend/src/pages/Dashboard.jsx` | **Modified** — avatar button navigates to `/account` |
| `frontend/src/App.css` | **Modified** — added all Account and Admin page styles |

### Backend

| File | Change |
|------|--------|
| `backend/main.py` | **Modified** — added Firebase Admin SDK init, `require_admin` dependency, 3 admin endpoints, fixed `/chat` bug |
| `backend/requirements.txt` | **Modified** — added `firebase-admin`, `PyMuPDF`, `python-multipart` |
| `backend/.gitignore` | **Created** — excludes `serviceAccountKey.json`, `__pycache__`, `.env` |

---

## What Each Feature Does

### Account Page (`/account`)
- View profile (avatar with initials, email, join date)
- Change username — inline edit, saves to Firebase Auth `displayName` and Firestore `users/{uid}`
- Change password — requires current password for re-authentication, then updates via Firebase Auth
- Password fields have show/hide eye toggle

### Admin Dashboard (`/admin`)
- Separate layout — no sidebar, standalone page
- Only accessible to users listed in Firestore `admins` collection
- Stats cards — total users, currently shown count
- Search bar to filter by username or email
- User table — Username | Email | Joined date | Actions
- Actions per user:
  - **Edit** — inline username edit
  - **Reset Password** — sends Firebase password reset email to user
  - **Delete** — confirm modal, deletes from Firebase Auth + Firestore
- Admin cannot delete their own account (blocked on both frontend and backend)
- Toast notifications for success/error feedback

---

## Firebase Configuration (Required Steps)

### Step 1 — Get the Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com) → your project
2. Click the gear icon → **Project Settings**
3. Go to the **Service accounts** tab
4. Click **Generate new private key** → confirm download
5. Rename the downloaded file to `serviceAccountKey.json`
6. Place it in the `backend/` folder:
   ```
   Kudos/
   └── backend/
       ├── main.py
       ├── serviceAccountKey.json   ← here
   ```

> **Important:** Never commit this file to GitHub. It is already listed in `backend/.gitignore`.

### Step 2 — Create an Admin Account

1. Open the app and register a new account (this will be the admin account)
2. Go to **Firebase Console → Authentication → Users**
3. Find the account and **copy its UID**

### Step 3 — Create the `admins` Firestore Collection

1. Go to **Firebase Console → Firestore Database**
2. Click **+ Start collection**
3. Collection ID: `admins`
4. Document ID: paste the UID copied from Step 2
5. Add a field:
   - Field name: `role`
   - Type: `string`
   - Value: `admin`
6. Click **Save**

---

## Installing New Backend Dependencies

Your backend requires `firebase-admin` to be installed. Use **Anaconda Prompt** (not PowerShell):

```bash
cd C:\Users\IM11\Desktop\Kudos\backend
pip install firebase-admin
```

Or install all requirements at once:

```bash
pip install -r requirements.txt
```

> **Why Anaconda Prompt?** Your machine has Python installed via Anaconda. The regular PowerShell terminal cannot find Python because it is not in the system PATH. Anaconda Prompt sets up the correct environment automatically.

---

## Running the App

### Backend
Open **Anaconda Prompt**:
```bash
cd C:\Users\IM11\Desktop\Kudos\backend
uvicorn main:app --reload
```
Backend runs at: `http://localhost:8000`

### Frontend
Open a separate terminal:
```bash
cd C:\Users\IM11\Desktop\Kudos\frontend
npm run dev
```
Frontend runs at: `http://localhost:5173`

---

## Testing the Admin Module

1. Start both backend and frontend
2. Log in with the admin account created in the Firebase setup steps
3. You should be redirected to `/admin` instead of `/dashboard`
4. The admin panel shows all registered users

> **Note:** Only users who registered **after** the Register page was updated will appear in the admin panel (new users are saved to the `users` Firestore collection on signup). Existing users registered before this change will not appear unless manually added to Firestore.

---

## Known Limitations

- No chat history persistence — conversation resets on page refresh
- Backend URL is hardcoded as `http://localhost:8000` in each frontend component
- Existing users (registered before this update) won't appear in the admin panel
- Admin passwords cannot be viewed in plain text — Firebase never exposes stored passwords (by design)
