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
exports.listFromBank = exports.remove = exports.list = exports.add = void 0;
const zod_1 = require("zod");
const problemsService = __importStar(require("../services/problems"));
const roomsService = __importStar(require("../services/rooms"));
const sanitize_1 = require("../utils/sanitize");
const errors_1 = require("../utils/errors");
const addProblemSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(200),
    description: zod_1.z.string().min(10),
    difficulty: zod_1.z.enum(["Easy", "Medium", "Hard"]),
});
/**
 * Adds a problem to the room. Only the room owner can do this.
 */
const add = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;
        // Verify room exists and requester is the owner
        const room = await roomsService.findRoomById(roomId);
        if (!room) {
            throw new errors_1.AppError("Room not found.", 404);
        }
        if (room.ownerId !== userId) {
            throw new errors_1.AppError("Only the room owner can add problems.", 403);
        }
        const { title, description, difficulty } = addProblemSchema.parse(req.body);
        const problem = await problemsService.addProblem(roomId, (0, sanitize_1.escapeHtml)(title), (0, sanitize_1.sanitizeHtml)(description), difficulty);
        return res.success({ problem }, "Problem added successfully.", 201);
    }
    catch (error) {
        next(error);
    }
};
exports.add = add;
/**
 * Lists all problems for a room. Any participant can view.
 */
const list = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;
        // Verify room exists and requester is a participant or owner
        const room = await roomsService.findRoomById(roomId);
        if (!room) {
            throw new errors_1.AppError("Room not found.", 404);
        }
        const isOwner = room.ownerId === userId;
        const isParticipant = room.participants.some((p) => p.userId === userId);
        if (!isOwner && !isParticipant) {
            throw new errors_1.AppError("You are not a member of this room.", 403);
        }
        const problems = await problemsService.listProblems(roomId);
        return res.success({ problems });
    }
    catch (error) {
        next(error);
    }
};
exports.list = list;
/**
 * Deletes a problem from the room. Only the room owner can do this.
 */
const remove = async (req, res, next) => {
    try {
        const { roomId, problemId } = req.params;
        const userId = req.user.id;
        const room = await roomsService.findRoomById(roomId);
        if (!room) {
            throw new errors_1.AppError("Room not found.", 404);
        }
        if (room.ownerId !== userId) {
            throw new errors_1.AppError("Only the room owner can delete problems.", 403);
        }
        const problem = await problemsService.findProblemById(problemId);
        if (!problem || problem.roomId !== roomId) {
            throw new errors_1.AppError("Problem not found in this room.", 404);
        }
        await problemsService.deleteProblem(problemId);
        return res.success(null, "Problem deleted successfully.");
    }
    catch (error) {
        next(error);
    }
};
exports.remove = remove;
const searchBankSchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    difficulty: zod_1.z.enum(["Easy", "Medium", "Hard"]).optional(),
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
});
/**
 * Searches the Leetcode question bank.
 */
const listFromBank = async (req, res, next) => {
    try {
        const { search, difficulty, limit } = searchBankSchema.parse(req.query);
        const questions = await problemsService.listBankProblems(search, difficulty, limit);
        return res.success({ questions });
    }
    catch (error) {
        next(error);
    }
};
exports.listFromBank = listFromBank;
