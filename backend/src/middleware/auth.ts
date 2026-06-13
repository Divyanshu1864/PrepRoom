import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "prep-room-local-development-secret-key-12345";

// Extend Express Request type declaration to support user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
      };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized. Token missing." });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: "Unauthorized. Invalid token payload." });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized. User no longer exists." });
    }

    // Attach verified user context to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth verification failed:", error);
    return res.status(401).json({ message: "Unauthorized. Session expired or invalid." });
  }
}
