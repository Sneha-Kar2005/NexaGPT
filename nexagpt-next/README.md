# NexaGPT (Next.js + TypeScript + MongoDB + Gemini)

A ChatGPT-style assistant built with **Next.js 16 (App Router)**, **TypeScript**, **MongoDB (Mongoose)**,
**Tailwind CSS v4**, and Google Gemini (`gemini-3.5-flash-lite` by default — `gemini-2.5-flash-lite` is retired for new API keys).

## Features

- Email + password accounts (sign up / log in / log out); every user only sees their own chats
- **Pictures in chat**: ask "show me pics of sunflowers" and Gemini calls a `search_images` tool that
  finds real, freely licensed photos on Wikimedia Commons (no extra API key). Photos appear in a grid
  above the reply, open in a full-screen viewer with author/license/source, and are saved with the chat.
  (AI image *generation* needs a paid Gemini plan — the free tier has 0 quota for image models.)
- Real token streaming (NDJSON over `fetch`), with **Stop generating**; partial replies are saved
- Multi-turn conversations: the full chat history is sent to the model as context
- Chat history persisted in MongoDB, with URLs per chat (`/c/:id`) like ChatGPT
- Sidebar grouped by Today / Yesterday / Previous 7 days / …, search, rename and delete
- Auto-generated chat titles (Gemini)
- Edit a previous message and resend, regenerate the last answer, copy messages
- Markdown + GFM tables, syntax-highlighted code blocks with **Copy code**
- Light / dark / system theme; collapsible sidebar; mobile drawer layout
- Keyboard: `Enter` to send, `Shift+Enter` for a new line, `Ctrl+Shift+O` for a new chat
- Friendly error messages (missing or invalid API key, rate limits, database down) with **Retry**

## Prerequisites

- Node.js 20.9+
- MongoDB running locally (default `mongodb://127.0.0.1:27017`) or a MongoDB Atlas URI
- A Gemini API key: <https://aistudio.google.com/apikey>

## Setup

```bash
cd nexagpt-next
npm install
cp .env.example .env.local     # then set GEMINI_API_KEY and AUTH_SECRET in .env.local
npm run dev
```

Open <http://localhost:3000>. You'll be sent to **/login**; choose **Sign up** to create an account.
Chats created before accounts existed are given to the first account that signs up.

For a production build: `npm run build && npm start`.

### Environment variables (`.env.local`)

| Variable         | Required | Default                                | Description                     |
| ---------------- | -------- | -------------------------------------- | ------------------------------- |
| `GEMINI_API_KEY` | yes      | –                                      | Google AI Studio API key        |
| `MONGODB_URI`    | no       | `mongodb://127.0.0.1:27017/nexagpt`    | MongoDB connection string       |
| `AUTH_SECRET`    | yes      | –                                      | Long random string used to sign login sessions |
| `GEMINI_MODEL`   | no       | `gemini-3.5-flash-lite`                | Override the model              |

## Project structure

```
src/
├─ app/
│  ├─ layout.tsx                 Root layout (theme bootstrap script)
│  ├─ globals.css                Tailwind, theme tokens, markdown + code styles
│  ├─ (auth)/login, (auth)/register   Login and sign-up pages
│  ├─ (chat)/layout.tsx          Persistent chat shell (loads the logged-in user)
│  ├─ (chat)/page.tsx            New chat
│  ├─ (chat)/c/[threadId]/page.tsx
│  └─ api/
│     ├─ auth/{register,login,logout}/route.ts
│     ├─ chat/route.ts           POST: send / edit / regenerate, streams the reply
│     ├─ threads/route.ts        GET: list chats · DELETE: delete all
│     └─ threads/[threadId]/route.ts   GET · PATCH (rename) · DELETE
├─ components/                   ChatProvider (state), Sidebar, ChatHeader, ChatWindow,
│                                MessageItem, Markdown, Composer, ConfirmDialog, …
├─ lib/
│  ├─ auth.ts, session.ts        Session cookie (jose JWT) and current-user helpers
│  ├─ db.ts                      Cached Mongoose connection
│  ├─ gemini.ts                  @google/genai client, streaming + tool loop, title generation
│  ├─ images.ts                  Wikimedia Commons photo search (search_images tool)
│  ├─ types.ts                   Shared API types
│  └─ utils.ts, api.ts, serialize.ts
├─ models/Thread.ts              Thread { _id, userId, title, messages[], createdAt, updatedAt }
├─ models/User.ts                User { name, email, passwordHash }
└─ proxy.ts                      Redirects signed-out users to /login
```

## Authentication

- Passwords are hashed with bcrypt and stored in the `users` collection.
- On login a signed JWT (HS256, `jose`) is stored in an **httpOnly** `nexagpt_session` cookie for 30 days.
- `src/proxy.ts` redirects signed-out visitors to `/login` (and signed-in users away from it).
- Every API route checks the session and filters by `userId`, so users can't read or change other users' chats.

## API

All routes except `/api/auth/*` require a logged-in session (otherwise `401`).

| Method | Path                     | Body / notes |
| ------ | ------------------------ | ------------ |
| POST   | `/api/auth/register`     | `{ name, email, password }` (password 8–72 chars) |
| POST   | `/api/auth/login`        | `{ email, password }` |
| POST   | `/api/auth/logout`       | Clears the session cookie |
| GET    | `/api/threads`           | List chat summaries (newest first) |
| DELETE | `/api/threads`           | Delete all chats |
| GET    | `/api/threads/:id`       | Chat with messages |
| PATCH  | `/api/threads/:id`       | `{ "title": "..." }` |
| DELETE | `/api/threads/:id`       | Delete chat |
| POST   | `/api/chat`              | `{ action: "send", threadId, content, userMessageId, assistantMessageId }`<br>`{ action: "edit", threadId, content, userMessageId, assistantMessageId }`<br>`{ action: "regenerate", threadId, assistantMessageId }` |

`POST /api/chat` responds with `application/x-ndjson`, one event per line:
`{"type":"delta","text":"..."}`, `{"type":"status","text":"Searching for images…"}`, `{"type":"images","images":[...]}`, `{"type":"title","title":"..."}`, `{"type":"error","message":"..."}`, `{"type":"done"}`.

## Improvements over the original MERN version

| Original (Express + Vite) | This version |
| --- | --- |
| Only the latest message was sent to the model, so it had no memory | Full conversation history is sent |
| Fake typewriter effect after the whole reply arrived | Real streaming, with stop |
| Missing `return` after `res.status(404/400)` caused "headers already sent" crashes | Every handler returns early and validates input |
| Hard-coded `http://localhost:8080` URLs and a separate server | Same-origin Next.js API routes |
| No edit, regenerate, rename or search | All supported |
| Title = raw first message | AI-generated title |
| Invalid model name (`gpt-6-luna`) | Gemini Flash-Lite (configurable) |
