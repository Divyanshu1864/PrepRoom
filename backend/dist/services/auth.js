"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateUser = exports.registerUser = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "prep-room-local-development-secret-key-12345";
/**
 * Registers a new user account, hashes password, and signs JWT session token.
 */
const registerUser = async (name, email, password) => {
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });
    if (existingUser) {
        const error = new Error("Email is already in use.");
        error.code = "EMAIL_IN_USE";
        throw error;
    }
    const hashedPassword = await bcrypt_1.default.hash(password, 12);
    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
        },
    });
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
    };
};
exports.registerUser = registerUser;
/**
 * Validates credentials and signs a new JWT session token.
 */
const authenticateUser = async (email, password) => {
    const user = await prisma.user.findUnique({
        where: { email },
    });
    if (!user) {
        const error = new Error("Invalid email or password.");
        error.code = "INVALID_CREDENTIALS";
        throw error;
    }
    const isValidPassword = await bcrypt_1.default.compare(password, user.password);
    if (!isValidPassword) {
        const error = new Error("Invalid email or password.");
        error.code = "INVALID_CREDENTIALS";
        throw error;
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
    };
};
exports.authenticateUser = authenticateUser;
