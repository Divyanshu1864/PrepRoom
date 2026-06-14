import { Router } from "express";
import * as authController from "../controllers/auth";
import { requireAuth } from "../middleware/auth";
import { rateLimiter } from "../middleware/rate-limit";

const router = Router();

// POST /api/auth/register
router.post(
  "/register",
  rateLimiter({ windowMs: 3600000, max: 10, message: "Too many registrations. Please try again in an hour." }),
  authController.register
);

// POST /api/auth/login
router.post("/login", authController.login);

// POST /api/auth/logout
router.post("/logout", authController.logout);

// GET /api/auth/me
router.get("/me", requireAuth, authController.getCurrentUser);

export default router;
