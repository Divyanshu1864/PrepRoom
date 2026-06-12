# PrepRoom Project Plan

This document outlines the development plan for the PrepRoom application.

## Phase 1: Core Foundation & Authentication

**Goal:** Set up the project, database, and user authentication.

**Steps:**
1.  **Project Setup:** Initialize a Next.js project with TypeScript and TailwindCSS.
2.  **Database Setup:** Set up a PostgreSQL database and integrate Prisma. Run the initial migration.
3.  **UI Foundation:** Integrate ShadCN UI for the component library.
4.  **Authentication:**
    *   Implement Email/Password sign-up and login using NextAuth.js.
    *   Add Google OAuth as a second authentication method.
    *   Create protected routes and middleware to manage access.
5.  **User Profile:** Create a basic user profile page where users can update their name.

**Verification:**
*   Users can sign up, log in, and log out.
*   Protected pages are inaccessible to unauthenticated users.
*   User data is correctly stored in the database.

---

## Phase 2: Room System & Real-Time Chat

**Goal:** Implement the core room functionality, including creation, joining, and real-time chat.

**Steps:**
1.  **Room Management API:** Create API endpoints for creating, fetching, and joining rooms.
2.  **Dashboard UI:** Build the user dashboard to display lists of created and joined rooms.
3.  **Real-time Server:** Set up a Socket.io server for real-time communication.
4.  **Chat Implementation:**
    *   Integrate a chat component into the room page.
    *   Implement WebSocket events for sending and receiving messages.
    *   Display system messages for users joining and leaving.
5.  **Participant List:** Display a list of current participants in the room.

**Verification:**
*   Users can create new rooms.
*   Users can join rooms via a link or from the dashboard.
*   Chat messages are delivered in real-time to all participants in a room.
*   The participant list updates in real-time.

---

## Phase 3: Collaborative Code Editor & Execution

**Goal:** Integrate the collaborative code editor and code execution service.

**Steps:**
1.  **Editor Integration:** Add the Monaco Editor to the room page.
2.  **Collaboration Logic (Yjs):**
    *   Integrate Yjs for Conflict-free Replicated Data Types (CRDTs).
    *   Use a WebSocket provider (e.g., `y-websocket`) to sync document state between clients.
    *   Implement cursor awareness to show where other users are typing.
3.  **Problem Panel:** Create the UI for displaying the problem description.
4.  **Code Execution:**
    *   Integrate the Judge0 API client.
    *   Create a "Run Code" button that sends the editor content to the API.
    *   Display the execution output (stdout, stderr, errors) in the UI.

**Verification:**
*   Multiple users can type in the editor simultaneously and see each other's changes.
*   User cursors are visible to others in the room.
*   Code can be executed in Python, JavaScript, C++, and Java.
*   Execution results are displayed correctly.

---

## Phase 4: Deployment & Refinement

**Goal:** Deploy the MVP and refine the user experience.

**Steps:**
1.  **Containerization:** Create a `Dockerfile` for the application.
2.  **Deployment:** Deploy the application to Vercel (frontend) and Railway/Render (database/real-time server).
3.  **Security Review:**
    *   Implement rate limiting on sensitive API endpoints.
    *   Add validation and sanitization to all user inputs.
    *   Review room access controls.
4.  **UX Polish:** Gather initial feedback and make usability improvements.

**Verification:**
*   The application is live and accessible via a public URL.
*   The full user flow is functional in the production environment.
*   Basic security measures are in place.