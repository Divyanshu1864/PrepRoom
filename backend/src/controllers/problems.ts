import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as problemsService from "../services/problems";
import * as roomsService from "../services/rooms";
import { escapeHtml, sanitizeHtml } from "../utils/sanitize";
import { AppError } from "../utils/errors";

const addProblemSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().min(10),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
});

/**
 * Adds a problem to the room. Only the room owner can do this.
 */
export const add = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    // Verify room exists and requester is the owner
    const room = await roomsService.findRoomById(roomId);
    if (!room) {
      throw new AppError("Room not found.", 404);
    }
    if (room.ownerId !== userId) {
      throw new AppError("Only the room owner can add problems.", 403);
    }

    const { title, description, difficulty } = addProblemSchema.parse(req.body);

    const problem = await problemsService.addProblem(
      roomId,
      escapeHtml(title),
      sanitizeHtml(description),
      difficulty
    );

    return res.success({ problem }, "Problem added successfully.", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Lists all problems for a room. Any participant can view.
 */
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    // Verify room exists and requester is a participant or owner
    const room = await roomsService.findRoomById(roomId);
    if (!room) {
      throw new AppError("Room not found.", 404);
    }

    const isOwner = room.ownerId === userId;
    const isParticipant = room.participants.some((p) => p.userId === userId);

    if (!isOwner && !isParticipant) {
      throw new AppError("You are not a member of this room.", 403);
    }

    const problems = await problemsService.listProblems(roomId);
    return res.success({ problems });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a problem from the room. Only the room owner can do this.
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId, problemId } = req.params;
    const userId = req.user!.id;

    const room = await roomsService.findRoomById(roomId);
    if (!room) {
      throw new AppError("Room not found.", 404);
    }
    if (room.ownerId !== userId) {
      throw new AppError("Only the room owner can delete problems.", 403);
    }

    const problem = await problemsService.findProblemById(problemId);
    if (!problem || problem.roomId !== roomId) {
      throw new AppError("Problem not found in this room.", 404);
    }

    await problemsService.deleteProblem(problemId);
    return res.success(null, "Problem deleted successfully.");
  } catch (error) {
    next(error);
  }
};

const searchBankSchema = z.object({
  search: z.string().optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * Searches the Leetcode question bank.
 */
export const listFromBank = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, difficulty, limit } = searchBankSchema.parse(req.query);

    const questions = await problemsService.listBankProblems(search, difficulty, limit);
    return res.success({ questions });
  } catch (error) {
    next(error);
  }
};

