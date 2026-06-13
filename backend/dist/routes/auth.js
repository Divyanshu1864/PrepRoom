"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const rate_limit_1 = require("../middleware/rate-limit");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "prep-room-local-development-secret-key-12345";
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(80),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).max(64),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
// Helper to set cookie
const setAuthCookie = (res, token) => {
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: "lax",
    });
};
// POST /api/auth/register
// Limit registrations to 10 per hour per IP
router.post("/register", (0, rate_limit_1.rateLimiter)({ windowMs: 3600000, max: 10, message: "Too many registrations. Please try again in an hour." }), async (req, res) => {
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
        const hashedPassword = await bcrypt_1.default.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
        setAuthCookie(res, token);
        return res.status(201).json({
            message: "Account created successfully.",
            user: { id: user.id, email: user.email, name: user.name },
        });
    }
    catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({ message: "Unexpected server error." });
    }
});
// POST /api/auth/login
router.post("/login", async (req, res) => {
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
        const isValidPassword = await bcrypt_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Invalid email or password." });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
        setAuthCookie(res, token);
        return res.status(200).json({
            message: "Logged in successfully.",
            user: { id: user.id, email: user.email, name: user.name },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Unexpected server error." });
    }
});
// POST /api/auth/logout
router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    });
    return res.status(200).json({ message: "Logged out successfully." });
});
// GET /api/auth/me
router.get("/me", auth_1.requireAuth, (req, res) => {
    return res.status(200).json({ user: req.user });
});
exports.default = router;
