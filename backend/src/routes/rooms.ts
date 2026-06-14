import { Router } from "express";
import * as roomsController from "../controllers/rooms";
import { requireAuth } from "../middleware/auth";

const router = Router();

// POST /api/rooms - Create a room
router.post("/", requireAuth, roomsController.create);

// GET /api/rooms - List all user's rooms
router.get("/", requireAuth, roomsController.list);

// GET /api/rooms/:roomId - Get single room details
router.get("/:roomId", requireAuth, roomsController.getDetails);

// POST /api/rooms/:roomId/join - Join a room
router.post("/:roomId/join", requireAuth, roomsController.join);

// DELETE /api/rooms/:roomId - Delete a room (only for the owner)
router.delete("/:roomId", requireAuth, roomsController.deleteRoom);

export default router;


