import { Router } from "express";
import * as problemsController from "../controllers/problems";
import { requireAuth } from "../middleware/auth";

const router = Router({ mergeParams: true });

// POST /api/rooms/:roomId/problems — add a problem (owner only)
router.post("/:roomId/problems", requireAuth, problemsController.add);



// GET /api/rooms/:roomId/problems — list all problems (any participant)
router.get("/:roomId/problems", requireAuth, problemsController.list);

// DELETE /api/rooms/:roomId/problems/:problemId — delete a problem (owner only)
router.delete("/:roomId/problems/:problemId", requireAuth, problemsController.remove);

export default router;
