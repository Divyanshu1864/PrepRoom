import { Request, Response } from "express";
import { z } from "zod";
import * as authService from "../services/auth";

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

/**
 * Handles user signup requests.
 */
export const register = async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid registration payload.", errors: parsed.error.flatten() });
    }

    const { name, email, password } = parsed.data;

    const result = await authService.registerUser(name, email, password);
    setAuthCookie(res, result.token);

    return res.status(201).json({
      message: "Account created successfully.",
      user: result.user,
    });
  } catch (error: any) {
    if (error.code === "EMAIL_IN_USE") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Register controller error:", error);
    return res.status(500).json({ message: "Unexpected server error." });
  }
};

/**
 * Handles signin credentials authentication.
 */
export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login credentials." });
    }

    const { email, password } = parsed.data;

    const result = await authService.authenticateUser(email, password);
    setAuthCookie(res, result.token);

    return res.status(200).json({
      message: "Logged in successfully.",
      user: result.user,
    });
  } catch (error: any) {
    if (error.code === "INVALID_CREDENTIALS") {
      return res.status(401).json({ message: error.message });
    }
    console.error("Login controller error:", error);
    return res.status(500).json({ message: "Unexpected server error." });
  }
};

/**
 * Handles session logouts.
 */
export const logout = (req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return res.status(200).json({ message: "Logged out successfully." });
};

/**
 * Handles current session profile details retrieval.
 */
export const getCurrentUser = (req: Request, res: Response) => {
  return res.status(200).json({ user: req.user });
};
