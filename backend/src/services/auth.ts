import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "prep-room-local-development-secret-key-12345";

export interface UserDTO {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResult {
  user: UserDTO;
  token: string;
}

/**
 * Registers a new user account, hashes password, and signs JWT session token.
 */
export const registerUser = async (name: string, email: string, password: string): Promise<AuthResult> => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const error = new Error("Email is already in use.");
    (error as any).code = "EMAIL_IN_USE";
    throw error;
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

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
};

/**
 * Validates credentials and signs a new JWT session token.
 */
export const authenticateUser = async (email: string, password: string): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    const error = new Error("Invalid email or password.");
    (error as any).code = "INVALID_CREDENTIALS";
    throw error;
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    const error = new Error("Invalid email or password.");
    (error as any).code = "INVALID_CREDENTIALS";
    throw error;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
};
