import { Router } from "express";
import * as problemsController from "../controllers/problems";
import { requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/problems/bank — search the question bank
router.get("/", requireAuth, problemsController.listFromBank);

export default router;
