import express from "express";
import { createServer } from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server as SocketServer } from "socket.io";
import { WebSocketServer } from "ws";
import { PrismaClient } from "@prisma/client";
// @ts-ignore
import { setupWSConnection } from "y-websocket/bin/utils";

import authRouter from "./routes/auth";
import roomsRouter from "./routes/rooms";
import executeRouter from "./routes/execute";
import { escapeHtml } from "./utils/sanitize";
import path from "path";
import { responseMiddleware } from "./middleware/response";
import { errorHandler } from "./middleware/error";

const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

const app = express();

// Global Middlewares
app.use(
  cors({
    origin: "http://localhost:5173", // Vite dev port
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(responseMiddleware);

// HTTP Route Handlers
app.use("/api/auth", authRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/execute", executeRouter);

// Serve static assets in production
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(distPath, "index.html"));
    }
  });
} else {
  // Base Route
  app.get("/", (req, res) => {
    res.send("PrepRoom API is running.");
  });
}

// Global Error Handler
app.use(errorHandler);

// Create base HTTP Server
const httpServer = createServer(app);

// 1. Socket.io Configuration (Chat & Active Presence)
const io = new SocketServer(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST"],
  },
});

const activeUsers = new Map<string, { userId: string; username: string; roomId: string }>();

io.on("connection", (socket) => {
  console.log(`Socket client connected: ${socket.id}`);

  // Handle client joining a room
  socket.on("join-room", async ({ roomId, userId, username }) => {
    if (!roomId || !userId) return;

    const socketRoom = `room:${roomId}`;
    socket.join(socketRoom);

    activeUsers.set(socket.id, { userId, username: username || "Anonymous", roomId });
    console.log(`User ${username} joined socket room ${roomId}`);

    // Fetch and send message logs from DB
    try {
      const messages = await prisma.message.findMany({
        where: { roomId },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: { name: true },
          },
        },
      });

      const history = messages.map((m) => ({
        id: m.id,
        content: m.content,
        userId: m.userId,
        username: m.user?.name || "Anonymous",
        createdAt: m.createdAt,
      }));

      socket.emit("chat-history", history);
    } catch (err) {
      console.warn("Could not load database message logs, fallback to memory-only.");
    }

    // Broadcast system message
    const systemMsg = {
      id: `sys-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      content: `${username || "Someone"} has joined the room`,
      userId: "system",
      username: "System",
      createdAt: new Date(),
    };
    io.to(socketRoom).emit("message", systemMsg);

    // Sync online participant count
    const roomActiveUsers = Array.from(activeUsers.values())
      .filter((u) => u.roomId === roomId)
      .map((u) => u.userId);
    io.to(socketRoom).emit("room-users", roomActiveUsers);
  });

  // Handle client broadcasting a message
  socket.on("send-message", async ({ roomId, userId, username, content }) => {
    if (!roomId || !userId || !content) return;

    const socketRoom = `room:${roomId}`;
    const sanitizedContent = escapeHtml(content);

    try {
      const savedMsg = await prisma.message.create({
        data: {
          content: sanitizedContent,
          userId,
          roomId,
        },
      });

      io.to(socketRoom).emit("message", {
        id: savedMsg.id,
        content: savedMsg.content,
        userId: savedMsg.userId,
        username: username || "Anonymous",
        createdAt: savedMsg.createdAt,
      });
    } catch (err) {
      console.error("DB message save failed. Broadcasting in-memory fallback.");
      io.to(socketRoom).emit("message", {
        id: `msg-fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        content: sanitizedContent,
        userId,
        username: username || "Anonymous",
        createdAt: new Date(),
      });
    }
  });

  // Handle socket client disconnection
  socket.on("disconnect", () => {
    const userInfo = activeUsers.get(socket.id);
    if (userInfo) {
      const { roomId, username } = userInfo;
      const socketRoom = `room:${roomId}`;

      activeUsers.delete(socket.id);
      console.log(`User ${username} left socket room ${roomId}`);

      // Broadcast system message
      const systemMsg = {
        id: `sys-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        content: `${username} has left the room`,
        userId: "system",
        username: "System",
        createdAt: new Date(),
      };
      io.to(socketRoom).emit("message", systemMsg);

      // Sync online participant list
      const roomActiveUsers = Array.from(activeUsers.values())
        .filter((u) => u.roomId === roomId)
        .map((u) => u.userId);
      io.to(socketRoom).emit("room-users", roomActiveUsers);
    }
  });
});

// 2. Yjs Collaboration Server Setup (ws layer)
const wss = new WebSocketServer({ noServer: true });
wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req, { gc: true });
});

// Intercept Upgrade request paths starting with /yjs
httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://${request.headers.host}`);
  if (url.pathname.startsWith("/yjs")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

// Boot servers
httpServer.listen(PORT, () => {
  console.log(`Express API & WebSockets running on http://localhost:${PORT}`);
});
