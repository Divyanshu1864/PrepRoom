import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

import { requireAuth } from "../middleware/auth";
import { rateLimiter } from "../middleware/rate-limit";

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "prep-room-local-development-secret-key-12345";

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(64),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Helper to set cookie
const setAuthCookie = (res: Response, token: string) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: "lax",
  });
};

// POST /api/auth/register
// Limit registrations to 10 per hour per IP
router.post(
  "/register",
  rateLimiter({ windowMs: 3600000, max: 10, message: "Too many registrations. Please try again in an hour." }),
  async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid registration payload.", errors: parsed.error.flatten() });
      }

      const { name, email, password } = parsed.data;

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({ message: "Email is already in use." });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      setAuthCookie(res, token);

      return res.status(201).json({
        message: "Account created successfully.",
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({ message: "Unexpected server error." });
    }
  }
);

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login credentials." });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(res, token);

    return res.status(200).json({
      message: "Logged in successfully.",
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Unexpected server error." });
  }
});

// POST /api/auth/logout
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return res.status(200).json({ message: "Logged out successfully." });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req: Request, res: Response) => {
  return res.status(200).json({ user: req.user });
});

export default router;
