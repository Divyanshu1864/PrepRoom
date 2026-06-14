"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const sanitize_1 = require("../utils/sanitize");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const createRoomSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(100),
    description: zod_1.z.string().max(500).optional(),
});
// POST /api/rooms - Create a room
router.post("/", auth_1.requireAuth, async (req, res) => {
    try {
        const parsed = createRoomSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid payload.", errors: parsed.error.flatten() });
        }
        const { title, description } = parsed.data;
        const sanitizedTitle = (0, sanitize_1.escapeHtml)(title);
        const sanitizedDescription = description ? (0, sanitize_1.escapeHtml)(description) : null;
        const userId = req.user.id; // Authenticated by requireAuth
        // Create room and add owner as participant in a transaction
        const room = await prisma.room.create({
            data: {
                title: sanitizedTitle,
                description: sanitizedDescription,
                ownerId: userId,
                participants: {
                    create: {
                        userId,
                    },
                },
            },
            include: {
                owner: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
        return res.status(201).json({ room });
    }
    catch (error) {
        console.error("Create room error:", error);
        return res.status(500).json({ message: "Unexpected server error." });
    }
});
// GET /api/rooms - List all user's rooms
router.get("/", auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const rooms = await prisma.room.findMany({
            where: {
                participants: {
                    some: {
                        userId,
                    },
                },
            },
            include: {
                owner: {
                    select: { id: true, name: true, email: true },
                },
                _count: {
                    select: { participants: true },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return res.status(200).json({ rooms });
    }
    catch (error) {
        console.error("Fetch rooms error:", error);
        return res.status(500).json({ message: "Unexpected server error." });
    }
});
// GET /api/rooms/:roomId - Get single room details
router.get("/:roomId", auth_1.requireAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;
        const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: {
                owner: {
                    select: { id: true, name: true, email: true },
                },
                participants: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                problems: true,
            },
        });
        if (!room) {
            return res.status(404).json({ message: "Room not found." });
        }
        const isOwner = room.ownerId === userId;
        const isParticipant = room.participants.some((p) => p.userId === userId);
        if (!isOwner && !isParticipant) {
            return res.status(403).json({ message: "Forbidden. You are not a participant in this room." });
        }
        return res.status(200).json({ room });
    }
    catch (error) {
        console.error("Fetch single room error:", error);
        return res.status(500).json({ message: "Unexpected server error." });
    }
});
// POST /api/rooms/:roomId/join - Join a room
router.post("/:roomId/join", auth_1.requireAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;
        const room = await prisma.room.findUnique({
            where: { id: roomId },
        });
        if (!room) {
            return res.status(404).json({ message: "Room not found." });
        }
        // Check if already a participant
        const existingParticipant = await prisma.participant.findUnique({
            where: {
                userId_roomId: {
                    userId,
                    roomId,
                },
            },
        });
        if (existingParticipant) {
            return res.status(200).json({ message: "You are already a participant in this room." });
        }
        // Add user as participant
        await prisma.participant.create({
            data: {
                userId,
                roomId,
            },
        });
        return res.status(201).json({ message: "Joined room successfully." });
    }
    catch (error) {
        console.error("Join room error:", error);
        return res.status(500).json({ message: "Unexpected server error." });
    }
});
// DELETE /api/rooms/:roomId - Delete a room (only for the owner)
router.delete("/:roomId", auth_1.requireAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;
        const room = await prisma.room.findUnique({
            where: { id: roomId },
        });
        if (!room) {
            return res.status(404).json({ message: "Room not found." });
        }
        // Check if the user is the owner
        if (room.ownerId !== userId) {
            return res.status(403).json({ message: "Forbidden. Only the owner can delete this room." });
        }
        // Delete room (participants, messages, and problems cascade delete automatically)
        await prisma.room.delete({
            where: { id: roomId },
        });
        return res.status(200).json({ message: "Room deleted successfully." });
    }
    catch (error) {
        console.error("Delete room error:", error);
        return res.status(500).json({ message: "Unexpected server error." });
    }
});
exports.default = router;
