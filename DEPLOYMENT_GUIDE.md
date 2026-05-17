# Kudos — Cloud Run Deployment Guide

## What You Need Before Deploying

### 1. Fix Hardcoded URLs
Your frontend has `http://localhost:8000` hardcoded in multiple files:
- `frontend/src/pages/FileView.jsx` (line 16)
- `frontend/src/pages/SubjectDetail.jsx` (line 15)
- `frontend/src/pages/Chatbot.jsx` (line 6)
- `frontend/src/pages/Login.jsx` (line 7)
- `frontend/src/App.jsx` (line 54 — AdminRoute)

**Fix:** Replace all with an environment variable:
```js
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
```
Then create `frontend/.env.production`:
```
VITE_BACKEND_URL=https://your-backend-service-url.run.app
```

### 2. Two Dockerfiles Needed
You'll deploy **two separate Cloud Run services**: one for the frontend (static), one for the backend (API).

#### `backend/Dockerfile`
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

#### `frontend/Dockerfile`
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

#### `frontend/nginx.conf`
```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;
    location / {
        try_files $uri /index.html;
    }
}
```

### 3. Update CORS
In `backend/main.py`, add your Cloud Run frontend URL to `allow_origins`:
```python
allow_origins=["http://localhost:5173", "https://your-frontend.run.app"]
```

### 4. Environment Variables on Cloud Run
Set these in the Cloud Run backend service:
- `GEMINI_API_KEY` — your Gemini API key
- `FIREBASE_SERVICE_ACCOUNT` — path or JSON content (if using admin features)

### 5. Deploy Commands
```bash
# Deploy backend
cd backend
gcloud run deploy kudos-backend \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=your_key_here"

# Deploy frontend (after building with correct VITE_BACKEND_URL)
cd frontend
gcloud run deploy kudos-frontend \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated
```

### 6. Firebase Security
- Add your Cloud Run domain to Firebase **Authorized domains** (Authentication → Settings)
- Update Firestore security rules for production
- Restrict your Firebase API key to your deployed domain in Google Cloud Console

## Deployment Order
1. Fix hardcoded URLs → use env variable
2. Deploy backend first → get the URL
3. Set `VITE_BACKEND_URL` to backend URL
4. Deploy frontend → get the URL  
5. Update backend CORS with frontend URL → redeploy backend
6. Add both domains to Firebase authorized domains

> **Tip:** Tell the AI assistant in your next conversation: "I want to deploy Kudos to Cloud Run, here's my deployment guide" and share this file.
