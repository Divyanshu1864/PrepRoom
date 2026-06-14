import { Request, Response, NextFunction } from "express";
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
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    const result = await authService.registerUser(name, email, password);
    setAuthCookie(res, result.token);

    return res.success(
      { user: result.user },
      "Account created successfully.",
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Handles signin credentials authentication.
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await authService.authenticateUser(email, password);
    setAuthCookie(res, result.token);

    return res.success(
      { user: result.user },
      "Logged in successfully."
    );
  } catch (error) {
    next(error);
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
  return res.success(null, "Logged out successfully.");
};

/**
 * Handles current session profile details retrieval.
 */
export const getCurrentUser = (req: Request, res: Response) => {
  return res.success({ user: req.user });
};

