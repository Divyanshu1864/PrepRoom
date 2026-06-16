# PrepRoom 2.0 — Dual-Mode Product Design Document

This document outlines the vision and feature set for expanding PrepRoom from a single-purpose
collaborative editor into a dual-mode coding platform — **Interview Mode** and **Collab Mode**.

---

## The Big Picture

```
Landing Page
    ├── [Start Interview]  ──→  Interview Room  (structured, proctored, role-based)
    └── [Start Collab]     ──→  Collab Room     (current flow, open and casual)
```

Both modes share the same underlying infrastructure (rooms, sockets, Yjs editor, chat) but
enable different UI surfaces, permissions, and safety guardrails.

---

## Mode 1 — Collab Mode (Current + Refined)

This is the existing experience, polished and extended.

### What It Is
Open-ended collaborative coding. Peers join, code together, chat, run code. No hierarchy,
no restrictions — just a shared whiteboard for code.

### New Additions to Collab Mode

| Feature | Description |
|---|---|
| **Sticky Notes on Editor** | Drag-and-drop text annotations directly on the editor pane |
| **Whiteboard Panel** | Freehand drawing canvas (using `rough.js` or `tldraw`) for diagramming |
| **Timer Widget** | Optional Pomodoro-style timer visible to all participants |
| **Problem Bank** | Owner can load LeetCode-style problems from a shared bank |
| **Code Snapshots** | Save named "checkpoints" of the editor state to revisit later |
| **Voice Huddle** | WebRTC push-to-talk (no persistent video — just press to speak) |
| **Rich Chat** | Markdown support, code blocks in chat, emoji reactions on messages |

---

## Mode 2 — Interview Mode (New)

A structured, proctored, role-enforced session between exactly two parties.

### Roles Inside an Interview Room

| Role | Created By | Capabilities |
|---|---|---|
| **Interviewer** | Creates the room | Full control — see below |
| **Interviewee** | Joins via link | Restricted — see below |

### Interviewer Capabilities (Higher Rights)
- ✅ Set the problem(s) — choose from bank or write custom
- ✅ Control which languages the interviewee can use
- ✅ Lock/unlock the editor for the interviewee
- ✅ Start / pause / end the interview session timer
- ✅ View private notes panel (invisible to interviewee)
- ✅ Add timestamped evaluation notes during the session
- ✅ Request interviewee to screenshare (browser-native)
- ✅ See focus-loss alerts and tab-switch events from interviewee
- ✅ End session and generate a PDF/markdown report
- ✅ Kick interviewee (end session for them remotely)

### Interviewee Capabilities (Restricted)
- ✅ Write code in the editor (in allowed languages only)
- ✅ Run code (with rate limit: e.g., 10 runs per session)
- ✅ View the problem statement
- ✅ Use the chat (to ask questions)
- ❌ Cannot see the interviewer's private notes
- ❌ Cannot change the problem
- ❌ Cannot leave and re-join freely (must be allowed by interviewer)
- ❌ Cannot change the programming language (if locked)

---

## Anti-Cheat & Proctoring System (Interview Mode Only)

> These features apply **only** to the Interviewee inside an Interview Room.

### Tab & Focus Detection
- Browser `visibilitychange` and `blur` events tracked client-side
- Every tab-switch and window-focus-loss event is **timestamped and streamed to the Interviewer**
  in real time via Socket.io
- Interviewer sees a live "Activity Log" panel:
  ```
  [14:32:01] Interviewee switched away from tab
  [14:32:09] Interviewee returned to tab (8s away)
  [14:35:44] Interviewee switched away from tab
  ```

### Copy-Paste Detection
- `paste` events in the Monaco editor are intercepted and logged
- Interviewer sees a toast + a log entry when paste occurs
- Optionally: disable paste entirely (interviewer toggle)

### Screenshare Request
- Interviewer can click "Request Screenshare"
- Interviewee sees a modal asking for permission
- Uses `getDisplayMedia()` — browser native, no plugins
- Feed is shown only to the Interviewer in a small PiP window

### Code Velocity Heuristics (AI-Augmented, future)
- Track typing cadence — sudden large code blocks that appear instantly are flagged
- Not a hard block, just a soft signal shown in the activity log

### Session Integrity Lock (optional)
- If the interviewee navigates away from the page, a warning modal blocks the room
- If they close the tab, the interviewer is notified immediately

---

## Landing Page — Two-Mode Entry

The new landing page presents a clean hero with two clear CTAs:

```
┌─────────────────────────────────────────────────────────┐
│                      PrepRoom                           │
│        The coding platform built for engineers          │
│                                                         │
│   ┌──────────────────┐    ┌──────────────────────┐     │
│   │  🎙️  Interview   │    │  👥  Collab          │     │
│   │                  │    │                      │     │
│   │  Conduct or take │    │  Code with friends,  │     │
│   │  structured      │    │  solve problems      │     │
│   │  technical       │    │  together — no       │     │
│   │  interviews with │    │  structure needed.   │     │
│   │  proctoring.     │    │                      │     │
│   │                  │    │                      │     │
│   │  [Start →]       │    │  [Start →]           │     │
│   └──────────────────┘    └──────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

- Clicking **Interview** directs to "Create Interview Room" or "Join as Interviewee"
- Clicking **Collab** directs to the existing Dashboard

---

## Session Report (Interview Mode)

After the interviewer ends the session, the system auto-generates a report:

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

Report is downloadable as PDF or copyable as Markdown.

---

## Role-Based Permission Model (Backend Design)

The `Participant` table needs a `role` field:

```prisma
model Participant {
  id        String          @id @default(cuid())
  userId    String
  roomId    String
  role      ParticipantRole @default(MEMBER)
  // ...
}

enum ParticipantRole {
  OWNER        // Creator — always present
  INTERVIEWER  // Interview mode: has elevated rights
  INTERVIEWEE  // Interview mode: restricted
  MEMBER       // Collab mode: peer, equal rights
}

model Room {
  // new fields:
  mode      RoomMode  @default(COLLAB)
  // ...
}

enum RoomMode {
  COLLAB
  INTERVIEW
}
```

---

## Database — New Tables for Interview Mode

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
  eventType   String   // "TAB_SWITCH", "PASTE", "FOCUS_LOSS", "SCREENSHARE_START" etc.
  metadata    Json?
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

---

## Socket Events — New Interview Mode Events

| Event | Direction | Description |
|---|---|---|
| `interview:start` | Server → All | Session officially begins |
| `interview:end` | Interviewer → Server | Session ends, triggers report gen |
| `focus:lost` | Interviewee → Server | Tab/focus lost |
| `focus:gained` | Interviewee → Server | Tab/focus regained |
| `paste:detected` | Interviewee → Server | Paste happened in editor |
| `editor:lock` | Interviewer → Server | Locks editor for interviewee |
| `editor:unlock` | Interviewer → Server | Unlocks editor |
| `screenshare:request` | Interviewer → Interviewee | Requests screenshare |
| `screenshare:accepted` | Interviewee → Interviewer | Peer signals acceptance |
| `note:added` | Server → Interviewer only | Private note created |
| `run:limit` | Server → Interviewee | Execution quota reached |

---

## What Stays the Same

- Auth system (JWT cookies)
- Room creation/join flow (same endpoints, `mode` added to payload)
- Monaco editor + Yjs collaborative sync
- Socket.io chat
- Code execution via Judge0

---

## Phased Roadmap

### Phase A — Foundation (Week 1-2)
- [ ] Schema changes: `RoomMode`, `ParticipantRole`, enums
- [ ] `mode` param added to room creation API + frontend modal
- [ ] Landing page redesign with two CTA cards
- [ ] Role assignment at join time for interview rooms

### Phase B — Interview Room UX (Week 3-4)
- [ ] Separate `InterviewWorkspace.tsx` page (fork of `RoomWorkspace.tsx`)
- [ ] Interviewer control panel (lock editor, set language, timer)
- [ ] Problem setter panel (pick from bank or write custom)
- [ ] Private interviewer notes panel

### Phase C — Anti-Cheat & Proctoring (Week 5-6)
- [ ] Focus/tab-switch detection on interviewee client
- [ ] Paste interception in Monaco editor
- [ ] Real-time Activity Log panel on interviewer side
- [ ] Screenshare request → accept flow using `getDisplayMedia()`
- [ ] Execution rate-limiting per session

### Phase D — Report Generation (Week 7)
- [ ] Session activity aggregation on session end
- [ ] Markdown report generation on backend
- [ ] PDF export (using `puppeteer` or `@react-pdf/renderer`)
- [ ] Report history per room

### Phase E — Collab Mode Upgrades (Week 8)
- [ ] Whiteboard panel integration
- [ ] Code snapshots
- [ ] Rich chat (markdown + code blocks)
- [ ] Timer widget

---

## Open Questions for You

1. **Screenshare** — Do you want the feed to be visible inside the PrepRoom UI, or just requested
   and confirmed (you trust the interviewee to share)?
2. **Report PDF** — Generate on the server (puppeteer), or render client-side and print-to-PDF?
3. **Problem Bank** — Build our own, scrape from LeetCode (legally grey), or integrate a 3rd
   party API (e.g., Codeforces, Exercism)?
4. **Voice** — WebRTC in-app voice, or just recommend Google Meet / Discord alongside PrepRoom?
5. **Paste Policy** — Hard-block paste (no pasting at all), or soft-flag (allow but log)?
6. **Max Participants in Interview Mode** — Strictly 2 (1 interviewer + 1 interviewee), or allow
   panel interviews (1 interviewee + N interviewers)?
