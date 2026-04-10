# AI Job Tracker

A full-stack AI-powered job application tracker built with React, TypeScript, Node.js, Express, and MongoDB.

Track your applications in a Kanban-style pipeline, parse job descriptions with AI, generate resume bullets, and manage follow-up reminders from one dashboard.

## Features

- Secure auth with JWT (register/login/protected routes)
- Application pipeline with status-based tracking
- Drag-and-drop status updates
- Follow-up reminders with overdue/today/upcoming logic
- AI Job Description parser (Groq SDK)
- Resume bullet generation from job descriptions
- Export data to CSV, PDF, and DOC
- Global loading/error/empty-state handling
- Light/Dark theme toggle with persistence

## Tech Stack

### Frontend

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Axios
- React Router

### Backend

- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT + bcryptjs
- Groq SDK

## Monorepo Structure

```text
ai-job-tracker/
  client/   # React frontend (Vercel)
  server/   # Express API (Render)
```

## Environment Variables

### Backend (`server/.env`)

```env
PORT=5000
MONGO_URI=<your_mongodb_connection_string>
JWT_SECRET=<your_jwt_secret>
GROQ_API_KEY=<your_groq_api_key>
```

### Frontend (Vercel Environment Variables)

```env
VITE_API_URL=<your_render_backend_url>
```

Example:

```env
VITE_API_URL=https://your-backend-service.onrender.com
```

## Local Development

### 1. Install dependencies

```bash
# frontend
cd client
npm install

# backend
cd ../server
npm install
```

### 2. Run backend

```bash
cd server
npm run dev
```

### 3. Run frontend

```bash
cd client
npm run dev
```

Frontend default dev URL: `http://localhost:5100`

## Production Build

### Frontend

```bash
cd client
npm run build
```

### Backend

```bash
cd server
npm run build
npm start
```

## API Overview

Base URL:

- Local: `http://localhost:5000`
- Production: your Render URL

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (protected)

### Applications (protected)

- `GET /api/applications`
- `POST /api/applications`
- `PUT /api/applications/:id`
- `DELETE /api/applications/:id`

### AI (protected)

- `POST /api/ai/parse-jd`

## Deployment Guide

### Backend on Render

- Root Directory: `server`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Add env vars: `MONGO_URI`, `JWT_SECRET`, `GROQ_API_KEY`

Notes:

- Server is configured to bind on `0.0.0.0` for Render port detection.
- Startup includes TypeScript build (`prestart`) before launch.

### Frontend on Vercel

- Root Directory: `client`
- Build Command: `npm run build`
- Output Directory: `dist`
- Add env var: `VITE_API_URL` (Render backend URL)

SPA routing:

- `client/vercel.json` includes rewrite to `index.html` so `/login`, `/register`, `/dashboard` work on refresh/direct access.

## Common Troubleshooting

### 1) Frontend shows `ERR_CONNECTION_REFUSED` to `localhost:5000`

Cause: deployed frontend cannot call local backend.

Fix: set `VITE_API_URL` in Vercel to your Render backend URL.

### 2) Vercel route gives 404 on `/register` or `/dashboard`

Cause: missing SPA rewrite.

Fix: ensure `client/vercel.json` exists and redeploy.

### 3) Render build fails with `Cannot find module 'groq-sdk'`

Cause: missing dependency.

Fix: ensure backend dependencies are installed from latest `server/package.json` and `server/package-lock.json`.

### 4) Render blocked by MongoDB connection

- Confirm `MONGO_URI` is set correctly.
- In MongoDB Atlas, allow network access (temporarily `0.0.0.0/0` if needed).

## Security Notes

- Never commit real `.env` files or API keys.
- Rotate secrets immediately if exposed.
- Keep `.env` only in local/dev and cloud environment variable settings.

## Scripts

### Frontend (`client/package.json`)

- `npm run dev`
- `npm run build`
- `npm run preview`

### Backend (`server/package.json`)

- `npm run dev`
- `npm run build`
- `npm start`

## License

This project is for educational and portfolio use. Update licensing as needed for production/business usage.
