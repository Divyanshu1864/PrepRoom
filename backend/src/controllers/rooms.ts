import { Request, Response } from "express";
import { z } from "zod";
import * as roomsService from "../services/rooms";
import { escapeHtml } from "../utils/sanitize";

const createRoomSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

/**
 * Creates a collaborative room.
 */
export const create = async (req: Request, res: Response) => {
  try {
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload.", errors: parsed.error.flatten() });
    }

    const { title, description } = parsed.data;
    const sanitizedTitle = escapeHtml(title);
    const sanitizedDescription = description ? escapeHtml(description) : null;
    const userId = req.user!.id;

    const room = await roomsService.createRoom(userId, sanitizedTitle, sanitizedDescription);
    return res.status(201).json({ room });
  } catch (error) {
    console.error("Create room controller error:", error);
    return res.status(500).json({ message: "Unexpected server error." });
  }
};

/**
 * Lists all rooms the user is participating in.
 */
export const list = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { search } = req.query;

    const rooms = await roomsService.listRooms(userId, search ? String(search) : undefined);
    return res.status(200).json({ rooms });
  } catch (error) {
    console.error("List rooms controller error:", error);
    return res.status(500).json({ message: "Unexpected server error." });
  }
};

/**
 * Gets details of a single room.
 */
export const getDetails = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const room = await roomsService.findRoomById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    const isOwner = room.ownerId === userId;
    const isParticipant = room.participants.some((p) => p.userId === userId);

    if (!isOwner && !isParticipant) {
      return res.status(403).json({ message: "Forbidden. You are not a participant in this room." });
    }

    return res.status(200).json({ room });
  } catch (error) {
    console.error("Get details controller error:", error);
    return res.status(500).json({ message: "Unexpected server error." });
  }
};

/**
 * Joins a user to a room.
 */
export const join = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const result = await roomsService.joinRoom(userId, roomId);
    if (result.alreadyJoined) {
      return res.status(200).json({ message: "You are already a participant in this room." });
    }

    return res.status(201).json({ message: "Joined room successfully." });
  } catch (error: any) {
    if (error.code === "ROOM_NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    console.error("Join room controller error:", error);
    return res.status(500).json({ message: "Unexpected server error." });
  }
};

/**
 * Deletes a room if ownership is verified.
 */
export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const room = await roomsService.findRoomById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    if (room.ownerId !== userId) {
      return res.status(403).json({ message: "Forbidden. Only the owner can delete this room." });
    }

    await roomsService.deleteRoom(roomId);
    return res.status(200).json({ message: "Room deleted successfully." });
  } catch (error) {
    console.error("Delete room controller error:", error);
    return res.status(500).json({ message: "Unexpected server error." });
  }
};
