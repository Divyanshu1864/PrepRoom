"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "prep-room-local-development-secret-key-12345";
async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized. Token missing." });
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
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
    }
    catch (error) {
        console.error("Auth verification failed:", error);
        return res.status(401).json({ message: "Unauthorized. Session expired or invalid." });
    }
}
