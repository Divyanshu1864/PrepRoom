"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRoom = exports.join = exports.getDetails = exports.list = exports.create = void 0;
const zod_1 = require("zod");
const roomsService = __importStar(require("../services/rooms"));
const sanitize_1 = require("../utils/sanitize");
const errors_1 = require("../utils/errors");
const createRoomSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(100),
    description: zod_1.z.string().max(500).optional(),
});
/**
 * Creates a collaborative room.
 */
const create = async (req, res, next) => {
    try {
        const { title, description } = createRoomSchema.parse(req.body);
        const sanitizedTitle = (0, sanitize_1.escapeHtml)(title);
        const sanitizedDescription = description ? (0, sanitize_1.escapeHtml)(description) : null;
        const userId = req.user.id;
        const room = await roomsService.createRoom(userId, sanitizedTitle, sanitizedDescription);
        return res.success({ room }, "Room created successfully.", 201);
    }
    catch (error) {
        next(error);
    }
};
exports.create = create;
/**
 * Lists all rooms the user is participating in.
 */
const list = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { search } = req.query;
        const rooms = await roomsService.listRooms(userId, search ? String(search) : undefined);
        return res.success({ rooms });
    }
    catch (error) {
        next(error);
    }
};
exports.list = list;
/**
 * Gets details of a single room.
 */
const getDetails = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;
        const room = await roomsService.findRoomById(roomId);
        if (!room) {
            throw new errors_1.AppError("Room not found.", 404);
        }
        const isOwner = room.ownerId === userId;
        const isParticipant = room.participants.some((p) => p.userId === userId);
        if (!isOwner && !isParticipant) {
            throw new errors_1.AppError("Forbidden. You are not a participant in this room.", 403);
        }
        return res.success({ room });
    }
    catch (error) {
        next(error);
    }
};
exports.getDetails = getDetails;
/**
 * Joins a user to a room.
 */
const join = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;
        const result = await roomsService.joinRoom(userId, roomId);
        if (result.alreadyJoined) {
            return res.success(null, "You are already a participant in this room.");
        }
        return res.success(null, "Joined room successfully.", 201);
    }
    catch (error) {
        next(error);
    }
};
exports.join = join;
/**
 * Deletes a room if ownership is verified.
 */
const deleteRoom = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;
        const room = await roomsService.findRoomById(roomId);
        if (!room) {
            throw new errors_1.AppError("Room not found.", 404);
        }
        if (room.ownerId !== userId) {
            throw new errors_1.AppError("Forbidden. Only the owner can delete this room.", 403);
        }
        await roomsService.deleteRoom(roomId);
        return res.success(null, "Room deleted successfully.");
    }
    catch (error) {
        next(error);
    }
};
exports.deleteRoom = deleteRoom;
