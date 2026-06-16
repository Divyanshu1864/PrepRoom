"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRoom = exports.joinRoom = exports.findRoomById = exports.listRooms = exports.createRoom = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Creates a new room and automatically registers the owner as a participant.
 */
const createRoom = async (userId, title, description, mode = "COLLAB") => {
    const initialRole = mode === "INTERVIEW" ? "INTERVIEWER" : "OWNER";
    return prisma.room.create({
        data: {
            title,
            description,
            ownerId: userId,
            mode,
            participants: {
                create: {
                    userId,
                    role: initialRole,
                },
            },
        },
        include: {
            owner: {
                select: { id: true, name: true, email: true },
            },
        },
    });
};
exports.createRoom = createRoom;
/**
 * Lists all rooms that a user is participating in, optionally filtered by a search query.
 */
const listRooms = async (userId, search) => {
    return prisma.room.findMany({
        where: {
            participants: {
                some: {
                    userId,
                },
            },
            OR: search
                ? [
                    { title: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ]
                : undefined,
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
};
exports.listRooms = listRooms;
/**
 * Fetches a single room detail including owner, participants, and problems.
 */
const findRoomById = async (roomId) => {
    return prisma.room.findUnique({
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
};
exports.findRoomById = findRoomById;
/**
 * Checks and registers a user to a room.
 */
const joinRoom = async (userId, roomId) => {
    const room = await prisma.room.findUnique({
        where: { id: roomId },
    });
    if (!room) {
        const error = new Error("Room not found.");
        error.code = "ROOM_NOT_FOUND";
        throw error;
    }
    const existingParticipant = await prisma.participant.findUnique({
        where: {
            userId_roomId: {
                userId,
                roomId,
            },
        },
    });
    if (existingParticipant) {
        return { alreadyJoined: true };
    }
    let assignedRole = "MEMBER";
    if (room.mode === "INTERVIEW") {
        assignedRole = room.ownerId === userId ? "INTERVIEWER" : "INTERVIEWEE";
    }
    await prisma.participant.create({
        data: {
            userId,
            roomId,
            role: assignedRole,
        },
    });
    return { alreadyJoined: false };
};
exports.joinRoom = joinRoom;
/**
 * Deletes a room and cascades deletion to all child tables.
 */
const deleteRoom = async (roomId) => {
    return prisma.room.delete({
        where: { id: roomId },
    });
};
exports.deleteRoom = deleteRoom;
