# PrepRoom — Complete Technical Master Document

> **Single source of truth** for the PrepRoom project. Covers current state (v1 implementation), v2 design decisions, every API endpoint, full DB schema, all key source files, WebSocket events, deployment, and the phased roadmap.

---

## Table of Contents

1. [What Is PrepRoom?](#1-what-is-preproom)
2. [Repository Structure](#2-repository-structure)
3. [Tech Stack](#3-tech-stack)
4. [Architecture & Service Ports](#4-architecture--service-ports)
5. [Environment Configuration](#5-environment-configuration)
6. [Database Schema (Prisma)](#6-database-schema-prisma)
7. [Backend — 3-Tier Architecture](#7-backend--3-tier-architecture)
   - [Middleware Layer](#71-middleware-layer)
   - [Routes Layer](#72-routes-layer)
   - [Controllers Layer](#73-controllers-layer)
   - [Services Layer](#74-services-layer)
   - [Utilities](#75-utilities)
8. [Full REST API Reference](#8-full-rest-api-reference)
9. [Real-Time System (Socket.io + Yjs)](#9-real-time-system-socketio--yjs)
   - [Socket.io Chat & Presence Events](#91-socketio-chat--presence-events)
   - [Yjs Collaborative Editor (WebSocket)](#92-yjs-collaborative-editor-websocket)
10. [Frontend — React SPA](#10-frontend--react-spa)
    - [Routing & Auth Guards](#101-routing--auth-guards)
    - [AuthContext](#102-authcontext)
    - [Pages](#103-pages)
    - [Key Component Interactions](#104-key-component-interactions)
11. [Code Execution Pipeline (Judge0)](#11-code-execution-pipeline-judge0)
12. [Question Bank](#12-question-bank)
13. [Docker & Production Deployment](#13-docker--production-deployment)
14. [Development Setup](#14-development-setup)
15. [Security Model](#15-security-model)
16. [PrepRoom v2.0 — Dual-Mode Product Design](#16-preproom-v20--dual-mode-product-design)
    - [Mode 1: Collab Mode](#161-mode-1-collab-mode-current--refined)
    - [Mode 2: Interview Mode](#162-mode-2-interview-mode-new)
    - [Anti-Cheat & Proctoring System](#163-anti-cheat--proctoring-system)
    - [Session Reports](#164-session-report-interview-mode)
    - [v2 Database Changes](#165-v2-database-changes)
    - [v2 Socket Events](#166-v2-socket-events)
17. [Phased Roadmap](#17-phased-roadmap)
18. [Open Questions & Design Decisions](#18-open-questions--design-decisions)

---

## 1. What Is PrepRoom?

PrepRoom is a **collaborative coding practice and mock interview platform** where developers create shared rooms to:

- Code together in a **real-time synchronized Monaco editor** (powered by Yjs CRDTs)
- **Run code** in a sandboxed environment (Python, JavaScript, C++, Java via Judge0)
- **Communicate via live chat** (Socket.io, persisted in PostgreSQL)
- **Track participants** and online presence in real time
- Assign **LeetCode-style problems** to rooms from a seeded question bank

PrepRoom is designed to be extended into a **dual-mode platform** (v2.0):
- **Collab Mode** — open-ended peer coding
- **Interview Mode** — structured, proctored, role-enforced sessions with anti-cheat features

---

## 2. Repository Structure

```
PrepRoom/                              ← Monorepo root
├── backend/                           ← Express + Node.js + TypeScript API & Websocket server
│   ├── prisma/
│   │   ├── schema.prisma              ← Prisma ORM schema (all tables & enums)
│   │   ├── seed-questions.ts          ← Seeds the QuestionBank from leetcode_questions.json
│   │   └── decode-problems.ts         ← Utility script to decode & format problem data
│   ├── src/
│   │   ├── @types/express.d.ts        ← Express Request interface augmentation (res.success / res.error)
│   │   ├── controllers/
│   │   │   ├── auth.ts                ← register, login, logout, getCurrentUser handlers
│   │   │   ├── execute.ts             ← execute code handler (proxies to Judge0)
│   │   │   ├── problems.ts            ← add, list, remove, listFromBank handlers
│   │   │   └── rooms.ts               ← create, list, getDetails, join, deleteRoom handlers
│   │   ├── middleware/
│   │   │   ├── auth.ts                ← JWT cookie verification → req.user injection
│   │   │   ├── error.ts               ← Global error handler (AppError + ZodError support)
│   │   │   ├── rate-limit.ts          ← In-memory sliding-window rate limiter
│   │   │   └── response.ts            ← Adds res.success() / res.error() decorators to Response
│   │   ├── routes/
│   │   │   ├── auth.ts                ← /api/auth routes
│   │   │   ├── bank.ts                ← /api/problems/bank routes
│   │   │   ├── execute.ts             ← /api/execute routes
│   │   │   ├── problems.ts            ← /api/rooms/:roomId/problems routes
│   │   │   └── rooms.ts               ← /api/rooms routes
│   │   ├── services/
│   │   │   ├── auth.ts                ← registerUser, authenticateUser (bcrypt + JWT)
│   │   │   ├── execute.ts             ← executeCode (Judge0 proxy, language mapping)
│   │   │   ├── problems.ts            ← addProblem, listProblems, deleteProblem, listBankProblems
│   │   │   └── rooms.ts               ← createRoom, listRooms, findRoomById, joinRoom, deleteRoom
│   │   └── utils/
│   │       ├── errors.ts              ← AppError class
│   │       └── sanitize.ts            ← escapeHtml, sanitizeHtml
│   └── server.ts                      ← Express init, all middleware, Socket.io, Yjs WS, HTTP listen
├── frontend/                          ← Vite + React 19 + TypeScript SPA
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── src/
│   │   ├── assets/
│   │   │   └── hero.png
│   │   ├── components/
│   │   │   └── ProtectedRoute.tsx     ← ProtectedRoute & PublicOnlyRoute wrappers
│   │   ├── context/
│   │   │   └── AuthContext.tsx        ← Global auth state (user, login, register, logout, checkAuth)
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx          ← Room list grid, create/join modals, search, delete
│   │   │   ├── Login.tsx              ← Auth sign-in page
│   │   │   ├── RoomWorkspace.tsx      ← Full coding workspace (editor + chat + participants + problems)
│   │   │   └── Signup.tsx             ← Account registration page
│   │   ├── App.css                    ← Global CSS overrides
│   │   ├── App.tsx                    ← BrowserRouter + route definitions + Toaster
│   │   ├── index.css                  ← TailwindCSS v4 directives + custom CSS vars
│   │   └── main.tsx                   ← ReactDOM root render
│   ├── index.html                     ← Root HTML (loads Inter from Google Fonts)
│   ├── vite.config.ts                 ← Vite config + /api proxy to localhost:5000
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   └── package.json
├── leetcode_questions.json            ← 20+ MB LeetCode question bank (seeded into DB)
├── Dockerfile                         ← Multi-stage Docker build (frontend → backend → runner)
├── .dockerignore
├── .env.example                       ← Template for required environment variables
├── package.json                       ← Root workspace scripts (dev, build:all, install:all)
├── plan.md                            ← Original 4-phase MVP development plan
├── preproom_v2_design.md              ← v2 dual-mode product design document
├── projectcontext.md                  ← Architecture + tech stack quick reference
└── requirements.txt                   ← Python deps (analysis/tooling scripts)
```

---

## 3. Tech Stack

### Backend

| Category | Technology | Version / Notes |
|---|---|---|
| Runtime | Node.js | 20.x (LTS) |
| Framework | Express | ^4.19.2 |
| Language | TypeScript | ^5.4.5 |
| Dev Server | ts-node-dev | `--respawn --transpile-only` |
| Database | PostgreSQL | via Prisma |
| ORM | Prisma | ^6.19.3 |
| Auth | JSON Web Tokens | `jsonwebtoken` ^9.0.2, stored as HttpOnly cookie |
| Password Hashing | bcrypt | ^6.0.0, saltRounds=12 |
| WebSockets (Chat) | Socket.io | ^4.7.5 |
| WebSockets (Editor) | ws + y-websocket | `^8.17.0` + `^1.5.4` |
| CRDT Engine | yjs + y-protocols | ^13.6.14 + ^1.0.6 |
| Cookie Parsing | cookie-parser | ^1.4.6 |
| CORS | cors | ^2.8.5 |
| Input Validation | zod | ^4.4.3 |
| Rate Limiting | Custom in-memory sliding-window | see `middleware/rate-limit.ts` |

### Frontend

| Category | Technology | Version / Notes |
|---|---|---|
| Framework | React | ^19.2.6 |
| Build Tool | Vite | ^8.0.12 |
| Language | TypeScript | ~6.0.2 |
| Routing | React Router DOM | ^7.17.0 |
| Styling | TailwindCSS | ^4.3.1 (via `@tailwindcss/vite` plugin) |
| Icons | Lucide React | ^1.18.0 |
| Toasts | Sonner | ^2.0.7 |
| Code Editor | @monaco-editor/react | ^4.7.0 |
| CRDT Sync | yjs + y-websocket + y-monaco | ^13.6.31 + ^1.5.4 + ^0.1.6 |
| Socket Client | socket.io-client | ^4.8.3 |
| UI Utilities | clsx, tailwind-merge, class-variance-authority, radix-ui |
| Theming | next-themes | ^0.4.6 |

### External Services

| Service | Usage |
|---|---|
| **Judge0 CE** (`ce.judge0.com`) | Remote code compilation & execution sandbox |
| **PostgreSQL** | Persistent storage for users, rooms, participants, messages, problems, question bank |

---

## 4. Architecture & Service Ports

```
                         ┌─────────────────────────┐
                         │      User's Browser      │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼──────────────────────┐
                    │                 │                        │
              UI Assets/HMR    HTTP API /api/*      WebSockets
                    │                 │          (Socket.io + Yjs)
                    ▼                 │                        │
         ┌──────────────────┐         └───────────┬────────────┘
         │  Vite Dev Server │                     │
         │  Port 5173       │         ┌───────────▼────────────┐
         └──────────────────┘         │    Express Server       │
                                      │    Port 5000            │
                                      │                         │
                                      │  /api/auth              │
                                      │  /api/rooms             │
                                      │  /api/execute           │
                                      │  /api/problems/bank     │
                                      │  /socket.io  ←──────── Chat & Presence
                                      │  /yjs        ←──────── Editor Sync
                                      └──────┬──────────────────┘
                                             │
                       ┌─────────────────────┼─────────────────────┐
                       │                     │                       │
                ┌──────▼──────┐   ┌──────────▼──────────┐  ┌──────▼──────┐
                │  PostgreSQL │   │     Prisma ORM       │  │   Judge0    │
                │  Database   │   │  (query builder)     │  │  ce.judge0  │
                └─────────────┘   └──────────────────────┘  └─────────────┘
```

### Local Dev Port Summary

| Service | Port | Notes |
|---|---|---|
| Vite Dev Server | `5173` | Serves React SPA; proxies `/api` → `5000` |
| Express API + WS | `5000` | All HTTP, Socket.io, and Yjs WS on one listener |
| PostgreSQL | `5432` | Default local PG port |

**Vite proxy** (`vite.config.ts`):
```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    },
  },
},
```

---

## 5. Environment Configuration

### Required Variables (`backend/.env`)

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/preproom"
JWT_SECRET="your-long-random-secret-key"
PORT=5000
NODE_ENV=development
```

### Legacy Variables (from initial Next.js phase, now unused)

```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

> **Note:** The `.env.example` at root still contains NextAuth keys from the original Phase 1 setup. The active backend uses only `DATABASE_URL`, `JWT_SECRET`, `PORT`, and `NODE_ENV`.

---

## 6. Database Schema (Prisma)

**File:** [`backend/prisma/schema.prisma`](file:///c:/Users/divya/Documents/PrepRoom/backend/prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── User ───────────────────────────────────────────────────
model User {
  id           String        @id @default(cuid())
  name         String?
  email        String        @unique
  password     String                          // bcrypt hash, saltRounds=12
  ownedRooms   Room[]        @relation("RoomOwner")
  participants Participant[]
  messages     Message[]
}

// ─── Room ───────────────────────────────────────────────────
model Room {
  id           String        @id @default(cuid())
  title        String
  description  String?
  ownerId      String
  owner        User          @relation("RoomOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  participants Participant[]
  problems     Problem[]
  messages     Message[]
  mode         RoomMode      @default(COLLAB)  // COLLAB | INTERVIEW
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

// ─── Participant ─────────────────────────────────────────────
model Participant {
  id        String          @id @default(cuid())
  userId    String
  roomId    String
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  room      Room            @relation(fields: [roomId], references: [id], onDelete: Cascade)
  role      ParticipantRole @default(MEMBER)   // OWNER | INTERVIEWER | INTERVIEWEE | MEMBER
  createdAt DateTime        @default(now())

  @@unique([userId, roomId])
}

// ─── Problem ─────────────────────────────────────────────────
model Problem {
  id          String   @id @default(cuid())
  title       String
  description String                            // May contain sanitized HTML from LeetCode bank
  difficulty  String                            // "Easy" | "Medium" | "Hard"
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ─── Message ─────────────────────────────────────────────────
model Message {
  id        String   @id @default(cuid())
  content   String                              // HTML-escaped via escapeHtml()
  userId    String
  roomId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

// ─── QuestionBank ─────────────────────────────────────────────
model QuestionBank {
  id          String   @id @default(cuid())
  questionId  String   @unique              // Original LeetCode problem ID
  title       String
  description String                        // Sanitized HTML problem body
  difficulty  String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ─── Enums ───────────────────────────────────────────────────
enum RoomMode {
  COLLAB
  INTERVIEW
}

enum ParticipantRole {
  OWNER        // Creator of a COLLAB room
  INTERVIEWER  // Creator of an INTERVIEW room (elevated rights)
  INTERVIEWEE  // Joining participant of an INTERVIEW room (restricted)
  MEMBER       // Regular participant of a COLLAB room
}
```

### Role Assignment Logic (Automatic, on room creation/join)

| Room Mode | Creator gets role | Joiner gets role |
|---|---|---|
| `COLLAB` | `OWNER` | `MEMBER` |
| `INTERVIEW` | `INTERVIEWER` | `INTERVIEWEE` |

---

## 7. Backend — 3-Tier Architecture

The backend follows a clean **Routes → Controllers → Services** separation.

### 7.1 Middleware Layer

#### `middleware/response.ts` — Response Decorator
Attaches helper methods to every `Response` object:
```ts
res.success(data, message?, statusCode?)  // { success: true, message, ...data }
res.error(message?, statusCode?, error?)  // { success: false, message, error? }
```

#### `middleware/auth.ts` — JWT Authentication Guard
- Reads `token` cookie from the request
- Verifies JWT against `JWT_SECRET`
- Queries Prisma for the user record
- Attaches `req.user = { id, email, name }` if valid
- Returns `401` if token missing, invalid, expired, or user not found

#### `middleware/rate-limit.ts` — In-Memory Sliding-Window Rate Limiter
- Stores `Map<ip, timestamp[]>` in process memory
- On each request: filters timestamps within `windowMs`, checks against `max`
- Returns `429` with custom message if limit exceeded
- Cleans up stale entries every 10 minutes (prevents memory leak)

Usage:
```ts
rateLimiter({ windowMs: 60000, max: 5, message: "Too many requests" })
```

#### `middleware/error.ts` — Global Error Handler (Express 4-arg middleware)
Handles:
- `AppError` → uses `err.statusCode` and `err.message`
- `ZodError` → 400 with flattened validation errors
- Named error codes (`EMAIL_IN_USE`, `INVALID_CREDENTIALS`, etc.) → mapped HTTP status
- Generic `Error` → 500 fallback
- In non-production: includes stack trace in response

Error code → status mapping:
```ts
{
  EMAIL_IN_USE: 409,
  INVALID_CREDENTIALS: 401,
  ROOM_NOT_FOUND: 404,
  UNSUPPORTED_LANGUAGE: 400,
  SANDBOX_ERROR: 502,
}
```

### 7.2 Routes Layer

| File | Mounted At | Protected? | Rate Limited? |
|---|---|---|---|
| `routes/auth.ts` | `/api/auth` | Partial (`/me` only) | Yes (`/register`: 10/hr) |
| `routes/bank.ts` | `/api/problems/bank` | Yes | No |
| `routes/rooms.ts` | `/api/rooms` | Yes | No |
| `routes/problems.ts` | `/api/rooms` | Yes | No |
| `routes/execute.ts` | `/api/execute` | Yes | Yes (5/min) |

### 7.3 Controllers Layer

Controllers parse/validate request data (via Zod schemas), call services, and return standardised responses.

#### `controllers/auth.ts`
- **Schemas:** `registerSchema` (name: 2-80, email, password: 8-64), `loginSchema`
- **`register`** — Validates body → `authService.registerUser()` → sets JWT cookie → `res.success(201)`
- **`login`** — Validates body → `authService.authenticateUser()` → sets JWT cookie → `res.success()`
- **`logout`** — Clears `token` cookie → `res.success()`
- **`getCurrentUser`** — Returns `req.user` (injected by `requireAuth` middleware)

Cookie config:
```ts
res.cookie("token", token, {
  httpOnly: true,                          // JS cannot read
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,        // 7 days
  sameSite: "lax",
})
```

#### `controllers/rooms.ts`
- **Schema:** `createRoomSchema` (title: 2-100, description: max 500, mode: COLLAB|INTERVIEW)
- **`create`** — Sanitises title/description → `roomsService.createRoom()` → `res.success(201)`
- **`list`** — Accepts `?search=` query param → `roomsService.listRooms()` → `res.success()`
- **`getDetails`** — Verifies caller is owner or participant → `roomsService.findRoomById()` → `res.success()`
- **`join`** — `roomsService.joinRoom()` → returns 200 (already joined) or 201 (newly joined)
- **`deleteRoom`** — Verifies ownership → `roomsService.deleteRoom()` → `res.success()`

#### `controllers/problems.ts`
- **Schema:** `addProblemSchema` (title: 2-200, description: min 10, difficulty: Easy|Medium|Hard)
- **`add`** — Owner-only; sanitises content → `problemsService.addProblem()`
- **`list`** — Owner or participant; `problemsService.listProblems()`
- **`remove`** — Owner-only; `problemsService.deleteProblem()`
- **`listFromBank`** — `searchBankSchema` (search?, difficulty?, limit: 1-100 default 20) → `problemsService.listBankProblems()`

#### `controllers/execute.ts`
- Validates body has `sourceCode` and `language`
- Calls `executeService.executeCode()` → spreads result into `res.success()`

### 7.4 Services Layer

Services contain all database queries and business logic. No direct HTTP knowledge.

#### `services/auth.ts`
- **`registerUser(name, email, password)`**
  - Checks for duplicate email (`findUnique`)
  - Hashes password: `bcrypt.hash(password, 12)`
  - Creates user record in DB
  - Signs JWT: `jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" })`
  - Returns `{ user: UserDTO, token }`

- **`authenticateUser(email, password)`**
  - Finds user by email
  - Compares with `bcrypt.compare()`
  - Signs new JWT
  - Returns `{ user: UserDTO, token }`

#### `services/rooms.ts`
- **`createRoom(userId, title, description, mode)`**
  - Determines initial role: `INTERVIEW` → `INTERVIEWER`, else `OWNER`
  - Creates room + participant in a single Prisma transaction
  
- **`listRooms(userId, search?)`**
  - Finds all rooms where user is a participant
  - Supports database-level case-insensitive search on `title` OR `description`
  - Includes owner info and `_count.participants`
  - Orders by `createdAt DESC`

- **`findRoomById(roomId)`**
  - Includes owner, all participants (with user info), and all problems

- **`joinRoom(userId, roomId)`**
  - Checks room exists
  - Checks if already a participant (`@@unique([userId, roomId])`)
  - Auto-assigns role: `INTERVIEW` rooms → `INTERVIEWEE` for non-owners; else `MEMBER`

- **`deleteRoom(roomId)`**
  - Cascade deletes: participants, problems, messages (via DB `onDelete: Cascade`)

#### `services/execute.ts`

Judge0 language ID mapping:
```ts
const LANGUAGE_MAPPING = {
  python:     71,  // Python 3.8.1
  javascript: 93,  // Node.js 18.15.0
  "c++":      54,  // C++ GCC 9.2.0
  cpp:        54,  // alias
  java:       62,  // Java OpenJDK 13.0.1
}
```

- Posts to `https://ce.judge0.com/submissions?wait=true` (synchronous wait)
- Returns: `{ stdout, stderr, compile_output, message, status: { id, description }, time, memory }`

#### `services/problems.ts`
- **`addProblem`** / **`listProblems`** / **`findProblemById`** / **`deleteProblem`** — Standard Prisma CRUD
- **`listBankProblems(search?, difficulty?, limit)`**
  - Queries `QuestionBank` table
  - Case-insensitive title search
  - Optional difficulty filter
  - Returns up to `limit` records ordered by `title ASC`

### 7.5 Utilities

#### `utils/errors.ts` — AppError
```ts
class AppError extends Error {
  statusCode: number
  code?: string
  details?: any
}
```
Used to throw predictable HTTP errors that the global error handler will format correctly.

#### `utils/sanitize.ts`
- **`escapeHtml(str)`** — Escapes `& < > " '` to HTML entities. Used for user-generated chat content and room titles.
- **`sanitizeHtml(str)`** — Strips `<script>` tags, `onXxx=` event handlers, and `javascript:` protocols. Used for problem description HTML.

---

## 8. Full REST API Reference

All requests require JSON body (`Content-Type: application/json`).  
All protected routes require a valid `token` HttpOnly cookie.

### Standard Response Envelope

**Success:**
```json
{ "success": true, "message": "...", /* ...spread data */ }
```

**Error:**
```json
{ "success": false, "message": "...", "error": { /* dev only */ } }
```

---

### Auth Endpoints (`/api/auth`)

#### `POST /api/auth/register`
Rate limited: 10/hour per IP.

**Body:**
```json
{ "name": "Divyanshu", "email": "user@email.com", "password": "securepass123" }
```

**Success (201):**
```json
{ "success": true, "message": "Account created successfully.", "user": { "id": "...", "email": "...", "name": "..." } }
```

Sets `token` cookie (HttpOnly, 7 days). Also logs user in immediately.

**Errors:** `409` (email in use), `400` (validation failed)

---

#### `POST /api/auth/login`

**Body:**
```json
{ "email": "user@email.com", "password": "securepass123" }
```

**Success (200):**
```json
{ "success": true, "message": "Logged in successfully.", "user": { "id": "...", "email": "...", "name": "..." } }
```

**Errors:** `401` (invalid credentials), `400` (validation)

---

#### `POST /api/auth/logout`

Clears `token` cookie. No body required.

**Success (200):**
```json
{ "success": true, "message": "Logged out successfully." }
```

---

#### `GET /api/auth/me` 🔒

Returns the currently authenticated user.

**Success (200):**
```json
{ "success": true, "message": "Success", "user": { "id": "...", "email": "...", "name": "..." } }
```

**Error:** `401` if no valid session.

---

### Room Endpoints (`/api/rooms`) 🔒

#### `POST /api/rooms`
Creates a new room. Creator is automatically added as a participant.

**Body:**
```json
{ "title": "Graph Algorithms Session", "description": "Optional description", "mode": "COLLAB" }
```
`mode` is `"COLLAB"` (default) or `"INTERVIEW"`.

**Success (201):**
```json
{
  "success": true,
  "message": "Room created successfully.",
  "room": {
    "id": "cuid...",
    "title": "...",
    "description": "...",
    "ownerId": "...",
    "mode": "COLLAB",
    "owner": { "id": "...", "name": "...", "email": "..." },
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

#### `GET /api/rooms`
Lists all rooms the user is participating in.

**Query Params:** `?search=graph` (optional, debounced on frontend at 300ms)

**Success (200):**
```json
{
  "success": true,
  "rooms": [
    {
      "id": "...", "title": "...", "description": "...", "ownerId": "...",
      "mode": "COLLAB",
      "owner": { "id": "...", "name": "...", "email": "..." },
      "_count": { "participants": 3 },
      "createdAt": "..."
    }
  ]
}
```

---

#### `GET /api/rooms/:roomId` 🔒
Returns full room details. Only participants or owner can access.

**Success (200):**
```json
{
  "room": {
    "id": "...", "title": "...", "ownerId": "...", "mode": "COLLAB",
    "participants": [
      { "userId": "...", "role": "OWNER", "user": { "id": "...", "name": "...", "email": "..." } }
    ],
    "problems": [ { "id": "...", "title": "...", "difficulty": "Easy", "description": "..." } ]
  }
}
```

**Errors:** `403` (not a participant), `404` (room not found)

---

#### `POST /api/rooms/:roomId/join` 🔒
Joins the current user to a room by room ID (the invite code).

**Success (201 or 200):**
```json
{ "success": true, "message": "Joined room successfully." }
// or "You are already a participant in this room." (200)
```

---

#### `DELETE /api/rooms/:roomId` 🔒
Deletes a room. Only the room owner can perform this. Cascades to all participants, problems, and messages.

**Success (200):**
```json
{ "success": true, "message": "Room deleted successfully." }
```

**Errors:** `403` (not owner), `404` (room not found)

---

### Problem Endpoints (`/api/rooms/:roomId/problems`) 🔒

#### `POST /api/rooms/:roomId/problems`
Owner-only. Adds a problem to the room.

**Body:**
```json
{ "title": "Two Sum", "description": "Given an array...", "difficulty": "Easy" }
```

**Success (201):** Returns the new `problem` object.

---

#### `GET /api/rooms/:roomId/problems`
Any room participant. Lists all problems for a room ordered by creation time.

**Success (200):** Returns `{ problems: [...] }`

---

#### `DELETE /api/rooms/:roomId/problems/:problemId` 🔒
Owner-only. Deletes a specific problem.

**Success (200):** `{ "message": "Problem deleted successfully." }`

---

### Question Bank (`/api/problems/bank`) 🔒

#### `GET /api/problems/bank`
Search the seeded LeetCode question bank.

**Query Params:**
- `search=two+sum` (optional, case-insensitive title match)
- `difficulty=Easy|Medium|Hard` (optional filter)
- `limit=20` (default 20, max 100)

**Success (200):**
```json
{
  "questions": [
    { "id": "...", "questionId": "1", "title": "Two Sum", "difficulty": "Easy", "description": "..." }
  ]
}
```

---

### Code Execution (`/api/execute`) 🔒

#### `POST /api/execute`
Rate limited: 5 runs per minute per IP.

**Body:**
```json
{ "sourceCode": "print('hello')", "language": "python" }
```

Supported languages: `python`, `javascript`, `c++` / `cpp`, `java`

**Success (200):**
```json
{
  "stdout": "hello\n",
  "stderr": null,
  "compile_output": null,
  "message": null,
  "status": { "id": 3, "description": "Accepted" },
  "time": "0.012",
  "memory": 9216
}
```

Judge0 status IDs: `3` = Accepted, `4` = Wrong Answer, `5` = Time Limit Exceeded, `6` = Compilation Error, etc.

**Errors:** `400` (unsupported language), `502` (Judge0 sandbox error)

---

## 9. Real-Time System (Socket.io + Yjs)

Both systems share the same underlying `http.Server` at port 5000.

### 9.1 Socket.io Chat & Presence Events

**Connection URL:** `http://localhost:5000` (dev) / `window.location.origin` (prod)  
**Transport:** `["websocket", "polling"]` with `withCredentials: true`

#### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `join-room` | `{ roomId, userId, username }` | Client joins a socket room, receives chat history |
| `send-message` | `{ roomId, userId, username, content }` | Sends a chat message (HTML-escaped, persisted to DB) |

#### Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `chat-history` | `ChatMessage[]` | Full message log from DB, sent on initial join |
| `message` | `ChatMessage` | New message (real user or system notification) |
| `room-users` | `string[]` | Updated list of online `userId`s in the room |

#### System Messages
The server broadcasts system messages (no userId) when:
- A user **joins**: `"<username> has joined the room"`
- A user **disconnects**: `"<username> has left the room"`

These are identified by `userId === "system"` on the frontend and styled as centered pills.

#### Active Presence Tracking
The server maintains an in-memory `Map<socketId, { userId, username, roomId }>`.
- Updated on `join-room` / `disconnect`
- `room-users` event fires with an array of all online `userId`s in that room
- Frontend uses this to show online/offline dot indicators on each participant

### 9.2 Yjs Collaborative Editor (WebSocket)

**Upgrade Path:** HTTP → WebSocket, handled via `httpServer.on("upgrade", ...)`  
**URL Pattern:** `/yjs` prefix (e.g., `ws://localhost:5000/yjs`)  
**Room Name:** `preproom-${roomId}` (unique per room)  
**Library:** `y-websocket` v1.5.4 (`setupWSConnection` with `gc: true`)

#### Client Setup (in `RoomWorkspace.tsx`)

```ts
// 1. Create Yjs document
const doc = new Y.Doc();

// 2. Connect WebSocket provider
const provider = new WebsocketProvider("ws://localhost:5000/yjs", `preproom-${roomId}`, doc);

// 3. Set user awareness (cursor color + name)
provider.awareness.setLocalStateField("user", { name: user.name, color: randomColor });

// 4. On Monaco mount: bind Yjs text to Monaco model
const yText = doc.getText("monaco");
const binding = new MonacoBinding(yText, editor.getModel(), new Set([editor]), provider.awareness);
```

#### Editor Default Templates

```ts
{
  javascript: "// JavaScript workspace\nfunction solve() { console.log('Hello, PrepRoom!'); }\nsolve();",
  python:     "# Python workspace\ndef solve():\n    print('Hello, PrepRoom!')\n\nif __name__ == '__main__':\n    solve()",
  cpp:        "// C++ workspace\n#include <iostream>\nint main() { std::cout << 'Hello, PrepRoom!' << std::endl; return 0; }",
  java:       "// Java workspace\npublic class Main { public static void main(String[] args) { System.out.println('Hello, PrepRoom!'); } }"
}
```

**Language Switch Logic:** If the current editor content matches any default template (or is empty), switching language replaces the content with the new language's template via a Yjs transaction.

---

## 10. Frontend — React SPA

### 10.1 Routing & Auth Guards

**File:** [`frontend/src/App.tsx`](file:///c:/Users/divya/Documents/PrepRoom/frontend/src/App.tsx)

```
/login       → PublicOnlyRoute → Login.tsx
/signup      → PublicOnlyRoute → Signup.tsx
/dashboard   → ProtectedRoute  → Dashboard.tsx
/rooms/:id   → ProtectedRoute  → RoomWorkspace.tsx
/*           → Navigate to /dashboard
```

**`ProtectedRoute`** — Redirects to `/login` if unauthenticated. Saves `location.state.from` for post-login redirect. Shows loading spinner while `AuthContext` is resolving.

**`PublicOnlyRoute`** — Redirects to `/dashboard` if user is already logged in.

### 10.2 AuthContext

**File:** [`frontend/src/context/AuthContext.tsx`](file:///c:/Users/divya/Documents/PrepRoom/frontend/src/context/AuthContext.tsx)

Global auth state managed via React Context. Exposes:

| Method | Description |
|---|---|
| `user: User \| null` | Current user `{ id, name, email }` or `null` |
| `loading: boolean` | True while `GET /api/auth/me` is in-flight on mount |
| `login(email, password)` | `POST /api/auth/login`, updates `user` state |
| `register(name, email, password)` | `POST /api/auth/register`, updates `user` state |
| `logout()` | `POST /api/auth/logout`, sets `user` to `null` |
| `checkAuth()` | `GET /api/auth/me`, resolves session on page load |

On mount (`useEffect`), `checkAuth()` is called to hydrate user state from the existing HttpOnly cookie.

### 10.3 Pages

#### `Dashboard.tsx`

The main hub after login.

**State managed:**
- `rooms[]` — list of user's rooms (fetched from `/api/rooms`)
- `searchQuery` — debounced (300ms) database-level search
- `isCreateModalOpen`, `createTitle`, `createDesc`, `createMode` — Create Room modal
- `joinRoomId`, `isJoining` — Join Room by ID

**Key behaviors:**
- On room creation: navigates to the new room AND copies room ID to clipboard (invite code)
- Room cards show: mode badge (Collab/Interview), participant count, owner name, date
- Trash icon only visible for rooms where `room.ownerId === user.id`
- Modal has two mode selector buttons (Collab / Interview) with distinct visual styles

#### `RoomWorkspace.tsx` (~1226 lines)

The core workspace. Rendered as a **full-height, flex-column layout**:

```
┌──────────────────────────── Header (h-14) ────────────────────────────────┐
│  ← Back  |  Room Title  |  Mode Badge  |  Room ID  |  [Problems] [Copy] [Lang▼] [▶ Run] │
├─────────────────┬──────────────────────────┬──────────────────────────────┤
│ Problem Panel   │  Monaco Editor (flex-1)  │  Chat / Participants (w-80)  │
│ (resizable,     ├──────────────────────────┤                              │
│  240-600px)     │  Console Output (h-56)   │                              │
│                 │                          │                              │
└─────────────────┴──────────────────────────┴──────────────────────────────┘
```

**Problem Panel (left):**
- Lists problems for the room (tabs)
- Active problem description rendered via `dangerouslySetInnerHTML` (server sanitized)
- Owner can add problems (opens modal with LeetCode bank search or manual entry)
- Owner can delete problems (trash icon on hover)
- Resizable via drag handle (`mousedown` → `mousemove` drag with min=240, max=600)
- Hidden on mobile (`hidden md:flex`)

**Monaco Editor (centre):**
- `@monaco-editor/react`, theme `vs-dark`, font size 14, no minimap
- Bound to Yjs shared text via `MonacoBinding`
- Awareness (cursors) shared with all connected peers

**Console Output (centre bottom, h-56):**
- Shows STDOUT, STDERR, COMPILE_OUTPUT after code run
- Displays execution time and memory usage

**Chat + Participants (right, w-80):**
- Tab switcher: Chat | People
- Chat messages: user messages (bubble style, right-aligned for self), system messages (center pills)
- Auto-scrolls to latest message via `chatEndRef`
- Participants list: online/offline green dot indicator

**LeetCode Bank Search in Add Problem modal:**
- Debounced 400ms input → `GET /api/problems/bank?search=...&limit=15`
- Click a result → auto-fills title, difficulty, description into form
- Dropdown closes on selection

#### `Login.tsx` / `Signup.tsx`

Standard auth forms. Use `useAuth()` context. Navigate to `/dashboard` on success.  
Styled dark mode with gradient backgrounds.

### 10.4 Key Component Interactions

```
User types in editor
  → Monaco editor change
  → MonacoBinding
  → Yjs YText delta
  → y-websocket (ws://localhost:5000/yjs/preproom-<roomId>)
  → Server: setupWSConnection (Yjs sync protocol)
  → Broadcast delta to all peers in room
  → Their YText updates → Monaco model updates

User sends chat message
  → socket.emit("send-message", { roomId, userId, username, content })
  → Server: escapeHtml(content), prisma.message.create()
  → io.to("room:<roomId>").emit("message", savedMsg)
  → All clients: setMessages(prev => [...prev, msg])
  → chatEndRef.scrollIntoView()

User clicks Run Code
  → editorRef.current.getValue()
  → POST /api/execute { sourceCode, language }
  → rateLimiter (5/min)
  → executeService.executeCode() → fetch Judge0 API (wait=true)
  → Result: setConsoleOutput({ stdout, stderr, compile_output, statusName, time, memory })
```

---

## 11. Code Execution Pipeline (Judge0)

PrepRoom uses **Judge0 CE** (Community Edition) public API at `ce.judge0.com`.

**Flow:**
1. Frontend: `POST /api/execute` with `{ sourceCode, language }`
2. Backend `requireAuth` → `rateLimiter(5/min)` → `executeController.execute`
3. Controller validates body → calls `executeService.executeCode(sourceCode, language)`
4. Service maps language string to Judge0 language ID
5. `fetch("https://ce.judge0.com/submissions?wait=true", { method: "POST", body: { source_code, language_id } })`
6. Judge0 compiles + runs code server-side, returns result synchronously
7. Backend returns result directly to frontend

**Supported Languages:**

| Language | Judge0 ID | Runtime |
|---|---|---|
| Python | 71 | Python 3.8.1 |
| JavaScript | 93 | Node.js 18.15.0 |
| C++ (`c++` or `cpp`) | 54 | GCC 9.2.0 |
| Java | 62 | OpenJDK 13.0.1 |

**Result Structure:**
```ts
{
  stdout: string | null,         // Base64 decoded by Judge0 before sending
  stderr: string | null,         // Compilation or runtime errors
  compile_output: string | null, // Compiler messages
  message: string | null,        // Any additional message
  status: { id: number, description: string },  // id=3 means Accepted
  time: string | null,           // Execution time in seconds
  memory: number | null,         // Memory usage in KB
}
```

---

## 12. Question Bank

**Source:** `leetcode_questions.json` (21 MB, in repo root) — contains thousands of LeetCode problems with `questionId`, `title`, `difficulty`, and `description` (HTML-formatted).

**Seeding Script:** [`backend/prisma/seed-questions.ts`](file:///c:/Users/divya/Documents/PrepRoom/backend/prisma/seed-questions.ts)
- Reads the JSON file
- Upserts each problem into `QuestionBank` using `questionId` as unique key

**API:** `GET /api/problems/bank?search=two+sum&difficulty=Easy&limit=20`

**Frontend usage in RoomWorkspace:**
- Room owner opens Add Problem modal
- Searches the bank (debounced 400ms)
- Click any result → auto-populates title, difficulty, description
- Owner submits → stored in `Problem` table linked to the room

---

## 13. Docker & Production Deployment

**File:** [`Dockerfile`](file:///c:/Users/divya/Documents/PrepRoom/Dockerfile)

Multi-stage build:

```dockerfile
# Stage 1: Build Frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build              # Outputs to /app/frontend/dist

# Stage 2: Build Backend Server
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate        # Generates Prisma Client
RUN npm run build              # tsc → /app/backend/dist

# Stage 3: Runner (minimal image)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install prod-only backend dependencies
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend --only=production

# Copy compiled artifacts
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/prisma ./backend/prisma
COPY --from=backend-builder /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=backend-builder /app/backend/node_modules/@prisma/client ./backend/node_modules/@prisma/client

# Copy frontend static build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 5000
CMD ["node", "backend/dist/server.js"]
```

**Production mode behavior (Express):**
```ts
if (process.env.NODE_ENV === "production") {
  app.use(express.static("../../frontend/dist"));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile("../../frontend/dist/index.html");
    }
  });
}
```

In production, the **single Express server** serves both the React SPA (static assets) and the API. No separate Vite server. CORS is also locked to same-origin.

---

## 14. Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL running locally (`localhost:5432`)
- (Optional) Docker

### Steps

```bash
# 1. Clone & install all dependencies
cd PrepRoom
npm run install:all

# 2. Set up backend environment
cp .env.example backend/.env
# Edit backend/.env with your DATABASE_URL and JWT_SECRET

# 3. Run DB migrations (first time)
cd backend
npx prisma migrate dev --name init

# 4. (Optional) Seed the question bank
npx ts-node prisma/seed-questions.ts

# 5. Start both servers concurrently (from root)
cd ..
npm run dev
```

### NPM Scripts (Root)

| Script | Command |
|---|---|
| `npm run install:all` | Installs deps in both `backend/` and `frontend/` |
| `npm run dev` | Starts backend (`ts-node-dev`) + frontend (Vite) concurrently with colour labels |
| `npm run dev:backend` | Backend only |
| `npm run dev:frontend` | Frontend only |
| `npm run build:all` | Builds both for production |
| `npm run build:backend` | `tsc` in backend |
| `npm run build:frontend` | `tsc -b && vite build` in frontend |

### Backend Scripts

```bash
npm run dev    # ts-node-dev --respawn --transpile-only src/server.ts
npm run build  # tsc (outputs to dist/)
npm run start  # node dist/server.js (production)
```

---

## 15. Security Model

| Concern | Implementation |
|---|---|
| **Authentication** | JWT in HttpOnly cookie (no XSS access via JS) |
| **CSRF** | `sameSite: "lax"` on cookie limits cross-site form submissions |
| **Password storage** | bcrypt, saltRounds=12 |
| **Input validation** | Zod schemas on all API inputs |
| **XSS prevention** | `escapeHtml()` on chat messages and room titles; `sanitizeHtml()` strips `<script>`, `onerror=`, `javascript:` from problem HTML |
| **SQL injection** | Not possible — all queries via Prisma parameterised queries |
| **Rate limiting** | Registration: 10/hr per IP; Code execution: 5/min per IP |
| **Room access control** | `getDetails` and `list` routes verify participant membership |
| **Room management** | Delete and add-problem require owner check |
| **CORS** | Restricted to `http://localhost:5173` in development; same-origin in production |
| **JWT expiry** | 7 days; no refresh token (re-login required after expiry) |

---

## 16. PrepRoom v2.0 — Dual-Mode Product Design

The v2 vision expands PrepRoom into a **dual-mode platform**.

```
Landing Page
    ├── [🎙 Interview]  ──→  Interview Room  (structured, proctored, role-based)
    └── [👥 Collab]     ──→  Collab Room     (current flow, open and casual)
```

Both modes share: auth system, room infrastructure, Monaco + Yjs editor, Socket.io chat, Judge0 execution.

### 16.1 Mode 1: Collab Mode (Current + Refined)

The existing experience, with planned additions:

| Feature | Description | Status |
|---|---|---|
| Collaborative Editor | Monaco + Yjs + awareness cursors | ✅ Implemented |
| Real-time Chat | Socket.io, persisted to DB | ✅ Implemented |
| Code Execution | Judge0 CE, 4 languages | ✅ Implemented |
| Problem Bank | LeetCode questions, searchable | ✅ Implemented |
| Problem Panel | Room-specific problems, owner-managed | ✅ Implemented |
| Delete Room | Owner can delete | ✅ Implemented |
| Room Modes | COLLAB / INTERVIEW enum in schema | ✅ Implemented |
| **Whiteboard Panel** | Freehand drawing (rough.js or tldraw) | 🔲 Planned |
| **Code Snapshots** | Named checkpoints of editor state | 🔲 Planned |
| **Sticky Notes** | Drag-and-drop annotations on editor pane | 🔲 Planned |
| **Timer Widget** | Pomodoro-style, visible to all | 🔲 Planned |
| **Voice Huddle** | WebRTC push-to-talk | 🔲 Planned |
| **Rich Chat** | Markdown, code blocks, emoji reactions | 🔲 Planned |

### 16.2 Mode 2: Interview Mode (New)

Structured, two-party session between an **Interviewer** and an **Interviewee**.

#### Role Capabilities

| Capability | Interviewer | Interviewee |
|---|---|---|
| Set problem(s) from bank or custom | ✅ | ❌ |
| Control allowed languages | ✅ | ❌ |
| Lock/unlock editor | ✅ | ❌ |
| Start / pause / end session timer | ✅ | ❌ |
| Private notes panel | ✅ | ❌ (invisible) |
| Add timestamped evaluation notes | ✅ | ❌ |
| Request screenshare | ✅ | ❌ |
| See activity log (tab switches, pastes) | ✅ | ❌ |
| Generate PDF/Markdown report | ✅ | ❌ |
| Kick interviewee | ✅ | ❌ |
| Write code (in allowed languages) | — | ✅ |
| Run code (rate-limited: 10/session) | — | ✅ |
| View problem statement | ✅ | ✅ |
| Use chat | ✅ | ✅ |
| Leave and re-join freely | ✅ | ❌ (must be allowed) |

### 16.3 Anti-Cheat & Proctoring System

*Applies only to the Interviewee inside an Interview Room.*

#### Tab & Focus Detection
```
Browser visibilitychange + blur events → timestamped → Socket.io → Interviewer Activity Log

[14:32:01] Interviewee switched away from tab
[14:32:09] Interviewee returned to tab (8s away)
[14:35:44] Interviewee switched away from tab
```

#### Copy-Paste Detection
- Monaco `paste` events intercepted client-side
- Logged with timestamp, sent to interviewer as toast + activity log entry
- Optional: disable paste entirely via interviewer toggle

#### Screenshare Request
- `getDisplayMedia()` — browser native, no plugins
- Initiator: Interviewer clicks "Request Screenshare"
- Interviewee sees permission modal
- Stream shown to Interviewer in a small PiP overlay panel

#### Code Velocity Heuristics (AI-Augmented, Future)
- Track typing cadence; sudden large code blocks that appear instantly are soft-flagged
- Not a hard block — shown as a signal in the activity log

#### Session Integrity Lock (Optional)
- If interviewee navigates away: warning modal blocks the room
- If they close the tab: interviewer is notified immediately via socket

### 16.4 Session Report (Interview Mode)

Auto-generated when interviewer ends the session:

```markdown
## Interview Report — Divyanshu Parate
Date: 15 June 2026 | Duration: 52m 14s

### Problems Given
1. Two Sum (Easy)
2. Longest Palindromic Substring (Medium)

### Execution Summary
- Total runs: 7
- Passed test cases: 2 / 3

### Activity Log
- 3 tab switches detected
- 1 paste event detected (14:37:22)
- Screenshare: Active for 48m

### Interviewer Notes
- Strong on brute force, struggled with optimisation
- Communication was clear and structured
- Recommend: System design round next
```

Downloadable as **PDF** (server-side puppeteer or `@react-pdf/renderer`) or copyable as **Markdown**.

### 16.5 v2 Database Changes

Additional tables needed for Interview Mode (not yet migrated):

```prisma
model InterviewSession {
  id             String    @id @default(cuid())
  roomId         String    @unique
  room           Room      @relation(...)
  startedAt      DateTime?
  endedAt        DateTime?
  durationSecs   Int?
  reportMarkdown String?
  reportPdfUrl   String?
}

model ActivityLog {
  id          String   @id @default(cuid())
  roomId      String
  userId      String
  eventType   String   // "TAB_SWITCH" | "PASTE" | "FOCUS_LOSS" | "SCREENSHARE_START" | etc.
  metadata    Json?    // { duration: 8, pastedChars: 250 }
  occurredAt  DateTime @default(now())
}

model InterviewerNote {
  id          String   @id @default(cuid())
  roomId      String
  authorId    String
  content     String
  createdAt   DateTime @default(now())
}
```

`Room` model already has `mode RoomMode @default(COLLAB)` and `Participant` already has `role ParticipantRole @default(MEMBER)` — both enum fields are in the current schema and ready for v2.

### 16.6 v2 Socket Events

New events needed for Interview Mode:

| Event | Direction | Description |
|---|---|---|
| `interview:start` | Server → All | Session officially begins |
| `interview:end` | Interviewer → Server | Ends session, triggers report gen |
| `focus:lost` | Interviewee → Server | Tab/focus lost |
| `focus:gained` | Interviewee → Server | Tab/focus regained |
| `paste:detected` | Interviewee → Server | Paste happened in Monaco editor |
| `editor:lock` | Interviewer → Server | Locks Monaco editor for interviewee |
| `editor:unlock` | Interviewer → Server | Unlocks editor |
| `screenshare:request` | Interviewer → Interviewee | Requests screenshare |
| `screenshare:accepted` | Interviewee → Interviewer | WebRTC signalling begins |
| `note:added` | Server → Interviewer only | Private note created |
| `run:limit` | Server → Interviewee | Execution quota (10/session) reached |

---

## 17. Phased Roadmap

### ✅ Phase 1 — Core Foundation & Auth (DONE)
- Next.js + PostgreSQL + Prisma initial setup
- Email/password authentication (bcrypt + JWT)
- Protected routes and middleware
- *(Note: The project later migrated away from Next.js to Vite + Express)*

### ✅ Phase 2 — Room System & Collaboration (DONE)
- Room creation, joining, listing, deleting
- Real-time chat (Socket.io, persisted)
- Yjs collaborative editor (Monaco + y-websocket + y-monaco)
- Cursor awareness
- Participant presence tracking

### ✅ Phase 3 — Code Execution & Problem Bank (DONE)
- Judge0 CE integration (4 languages)
- Rate-limited execution endpoint
- Problem management (add, list, delete per room)
- LeetCode question bank (seeded, searchable)
- Problem import from bank into room

### ✅ Phase 4 — Deployment & Refactoring (DONE)
- Multi-stage Dockerfile (frontend + backend → unified runner)
- Backend refactored to 3-tier (Routes / Controllers / Services)
- Debounced database-level search
- Response decorator middleware
- Centralized error handler
- Input sanitization

---

### 🔲 Phase A — v2 Foundation (Next)
- [ ] Schema migration: `InterviewSession`, `ActivityLog`, `InterviewerNote` tables
- [ ] Landing page redesign with two CTA cards (Interview / Collab)
- [ ] `mode` param fully wired through creation → workspace routing
- [ ] `InterviewWorkspace.tsx` — separate page forked from `RoomWorkspace.tsx`

### 🔲 Phase B — Interview Room UX
- [ ] Interviewer control panel (lock editor, set language, timer controls)
- [ ] Problem setter panel (pick from bank or write custom)
- [ ] Private interviewer notes panel (invisible to interviewee)
- [ ] Role-based UI rendering in workspace

### 🔲 Phase C — Anti-Cheat & Proctoring
- [ ] `visibilitychange` + `blur` detection on interviewee client
- [ ] Paste interception in Monaco (override paste command)
- [ ] Real-time Activity Log panel on interviewer side
- [ ] `getDisplayMedia()` screenshare request → accept flow
- [ ] Execution rate-limiting per session (10 runs, not per-IP)

### 🔲 Phase D — Report Generation
- [ ] Session activity aggregation on `interview:end`
- [ ] Markdown report generation on backend
- [ ] PDF export (puppeteer server-side or `@react-pdf/renderer` client-side)
- [ ] Report history accessible per room

### 🔲 Phase E — Collab Mode Upgrades
- [ ] Whiteboard panel (rough.js or tldraw)
- [ ] Code snapshots (named checkpoints)
- [ ] Rich chat (Markdown + code blocks + emoji reactions)
- [ ] Pomodoro timer widget

---

## 18. Open Questions & Design Decisions

| # | Question | Options | Notes |
|---|---|---|---|
| 1 | **Screenshare display** | Shown inside PrepRoom UI (PiP panel) vs just requested/confirmed | PiP adds complexity but better UX |
| 2 | **PDF generation** | Server (puppeteer) vs Client (print-to-PDF) | Server-side is more reliable but adds heavy dep |
| 3 | **Problem Bank source** | Use existing `leetcode_questions.json` vs scrape vs 3rd party API (Codeforces, Exercism) | JSON is seeded and working; legal clarity is best |
| 4 | **Voice** | WebRTC in-app (complex) vs recommend Google Meet / Discord alongside PrepRoom | WebRTC in-app for v2; Meet/Discord as fallback now |
| 5 | **Paste policy** | Hard-block (no paste at all) vs soft-flag (allow but log) | Soft-flag is less disruptive; interviewer can toggle |
| 6 | **Interview max participants** | Strictly 2 (1+1) vs panel interviews (1 interviewee + N interviewers) | Start with 2; N-interviewers as future extension |
| 7 | **JWT refresh** | Current: 7-day expiry, re-login required vs add refresh token rotation | Refresh tokens add complexity; fine for MVP |
| 8 | **Judge0 rate limits** | Public `ce.judge0.com` has undocumented global limits | Consider self-hosting or RapidAPI for production |
| 9 | **Yjs persistence** | Currently ephemeral (no DB-side document state) | Add `y-indexeddb` or server-side doc persistence for reliability |
