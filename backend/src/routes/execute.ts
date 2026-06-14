import { Router } from "express";
import * as executeController from "../controllers/execute";
import { requireAuth } from "../middleware/auth";
import { rateLimiter } from "../middleware/rate-limit";

const router = Router();

// POST /api/execute - Runs user code on Judge0 CE
// Rate limit: 5 execution requests per minute per IP address
router.post(
  "/",
  requireAuth,
  rateLimiter({
    windowMs: 60000,
    max: 5,
    message: "Too many code execution runs. Please wait a minute.",
  }),
  executeController.execute
);

export default router;

