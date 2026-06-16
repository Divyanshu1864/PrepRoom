import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as roomsService from "../services/rooms";
import { escapeHtml } from "../utils/sanitize";
import { AppError } from "../utils/errors";

const createRoomSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  mode: z.enum(["COLLAB", "INTERVIEW"]).default("COLLAB"),
});

/**
 * Creates a collaborative room.
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, mode } = createRoomSchema.parse(req.body);
    const sanitizedTitle = escapeHtml(title);
    const sanitizedDescription = description ? escapeHtml(description) : null;
    const userId = req.user!.id;

    const room = await roomsService.createRoom(userId, sanitizedTitle, sanitizedDescription, mode);
    return res.success({ room }, "Room created successfully.", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Lists all rooms the user is participating in.
 */
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { search } = req.query;

    const rooms = await roomsService.listRooms(userId, search ? String(search) : undefined);
    return res.success({ rooms });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets details of a single room.
 */
export const getDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const room = await roomsService.findRoomById(roomId);
    if (!room) {
      throw new AppError("Room not found.", 404);
    }

    const isOwner = room.ownerId === userId;
    const isParticipant = room.participants.some((p) => p.userId === userId);

    if (!isOwner && !isParticipant) {
      throw new AppError("Forbidden. You are not a participant in this room.", 403);
    }

    return res.success({ room });
  } catch (error) {
    next(error);
  }
};

/**
 * Joins a user to a room.
 */
export const join = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const result = await roomsService.joinRoom(userId, roomId);
    if (result.alreadyJoined) {
      return res.success(null, "You are already a participant in this room.");
    }

    return res.success(null, "Joined room successfully.", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a room if ownership is verified.
 */
export const deleteRoom = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const room = await roomsService.findRoomById(roomId);
    if (!room) {
      throw new AppError("Room not found.", 404);
    }

    if (room.ownerId !== userId) {
      throw new AppError("Forbidden. Only the owner can delete this room.", 403);
    }

    await roomsService.deleteRoom(roomId);
    return res.success(null, "Room deleted successfully.");
  } catch (error) {
    next(error);
  }
};

