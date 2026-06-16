"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const socket_io_1 = require("socket.io");
const ws_1 = require("ws");
const client_1 = require("@prisma/client");
// @ts-ignore
const utils_1 = require("y-websocket/bin/utils");
const auth_1 = __importDefault(require("./routes/auth"));
const rooms_1 = __importDefault(require("./routes/rooms"));
const execute_1 = __importDefault(require("./routes/execute"));
const problems_1 = __importDefault(require("./routes/problems"));
const bank_1 = __importDefault(require("./routes/bank"));
const sanitize_1 = require("./utils/sanitize");
const path_1 = __importDefault(require("path"));
const response_1 = require("./middleware/response");
const error_1 = require("./middleware/error");
const PORT = process.env.PORT || 5000;
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
// Global Middlewares
app.use((0, cors_1.default)({
    origin: "http://localhost:5173", // Vite dev port
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use(response_1.responseMiddleware);
// HTTP Route Handlers
app.use("/api/auth", auth_1.default);
app.use("/api/problems/bank", bank_1.default);
app.use("/api/rooms", rooms_1.default);
app.use("/api/rooms", problems_1.default);
app.use("/api/execute", execute_1.default);
// Serve static assets in production
if (process.env.NODE_ENV === "production") {
    const distPath = path_1.default.join(__dirname, "../../frontend/dist");
    app.use(express_1.default.static(distPath));
    app.get("*", (req, res) => {
        if (!req.path.startsWith("/api")) {
            res.sendFile(path_1.default.join(distPath, "index.html"));
        }
    });
}
else {
    // Base Route
    app.get("/", (req, res) => {
        res.send("PrepRoom API is running.");
    });
}
// Global Error Handler
app.use(error_1.errorHandler);
// Create base HTTP Server
const httpServer = (0, http_1.createServer)(app);
// 1. Socket.io Configuration (Chat & Active Presence)
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        credentials: true,
        methods: ["GET", "POST"],
    },
});
const activeUsers = new Map();
io.on("connection", (socket) => {
    console.log(`Socket client connected: ${socket.id}`);
    // Handle client joining a room
    socket.on("join-room", async ({ roomId, userId, username }) => {
        if (!roomId || !userId)
            return;
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
        }
        catch (err) {
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
        if (!roomId || !userId || !content)
            return;
        const socketRoom = `room:${roomId}`;
        const sanitizedContent = (0, sanitize_1.escapeHtml)(content);
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
        }
        catch (err) {
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
const wss = new ws_1.WebSocketServer({ noServer: true });
wss.on("connection", (ws, req) => {
    (0, utils_1.setupWSConnection)(ws, req, { gc: true });
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
