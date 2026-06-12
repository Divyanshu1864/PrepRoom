import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const PORT = process.env.SOCKET_PORT || 3001;
const prisma = new PrismaClient();

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Store mapping of socket.id -> { userId, username, roomId } for easy cleanup on disconnect
const activeUsers = new Map<string, { userId: string; username: string; roomId: string }>();

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle user joining a room
  socket.on("join-room", async ({ roomId, userId, username }) => {
    if (!roomId || !userId) return;

    const socketRoom = `room:${roomId}`;
    socket.join(socketRoom);

    // Save active user info
    activeUsers.set(socket.id, { userId, username: username || "Anonymous", roomId });

    console.log(`User ${username} (${userId}) joined room ${roomId}`);

    // Send chat history from database if available
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
      console.warn("Could not load chat history from database, running in-memory mode.");
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

    // Send active users list to all clients in the room
    const roomActiveUsers = Array.from(activeUsers.values())
      .filter((u) => u.roomId === roomId)
      .map((u) => u.userId);
    io.to(socketRoom).emit("room-users", roomActiveUsers);
  });

  // Handle user sending a message
  socket.on("send-message", async ({ roomId, userId, username, content }) => {
    if (!roomId || !userId || !content) return;

    const socketRoom = `room:${roomId}`;
    
    try {
      // Save message to database
      const savedMsg = await prisma.message.create({
        data: {
          content,
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
      console.error("Database save failed. Broadcasting in-memory message instead.");
      
      // Fallback: broadcast in-memory only
      io.to(socketRoom).emit("message", {
        id: `msg-fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        content,
        userId,
        username: username || "Anonymous",
        createdAt: new Date(),
      });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const userInfo = activeUsers.get(socket.id);
    if (userInfo) {
      const { roomId, username } = userInfo;
      const socketRoom = `room:${roomId}`;
      
      // Remove from active list
      activeUsers.delete(socket.id);
      
      console.log(`User ${username} disconnected from room ${roomId}`);

      // Broadcast system message
      const systemMsg = {
        id: `sys-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        content: `${username} has left the room`,
        userId: "system",
        username: "System",
        createdAt: new Date(),
      };
      io.to(socketRoom).emit("message", systemMsg);

      // Send active users list to all clients in the room
      const roomActiveUsers = Array.from(activeUsers.values())
        .filter((u) => u.roomId === roomId)
        .map((u) => u.userId);
      io.to(socketRoom).emit("room-users", roomActiveUsers);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`WebSocket server is running on http://localhost:${PORT}`);
});
