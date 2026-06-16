"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBankProblems = exports.deleteProblem = exports.findProblemById = exports.listProblems = exports.addProblem = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Adds a new problem to the specified room.
 */
const addProblem = async (roomId, title, description, difficulty) => {
    return prisma.problem.create({
        data: {
            roomId,
            title,
            description,
            difficulty,
        },
    });
};
exports.addProblem = addProblem;
/**
 * Lists all problems belonging to a room, ordered oldest-first.
 */
const listProblems = async (roomId) => {
    return prisma.problem.findMany({
        where: { roomId },
        orderBy: { createdAt: "asc" },
    });
};
exports.listProblems = listProblems;
/**
 * Returns a single problem by its ID.
 */
const findProblemById = async (problemId) => {
    return prisma.problem.findUnique({
        where: { id: problemId },
    });
};
exports.findProblemById = findProblemById;
/**
 * Deletes a problem by its ID.
 */
const deleteProblem = async (problemId) => {
    await prisma.problem.delete({
        where: { id: problemId },
    });
};
exports.deleteProblem = deleteProblem;
/**
 * Searches and lists questions from the Leetcode Question Bank.
 */
const listBankProblems = async (search, difficulty, limit = 20) => {
    const where = {};
    if (search) {
        where.title = {
            contains: search,
            mode: "insensitive",
        };
    }
    if (difficulty) {
        where.difficulty = difficulty;
    }
    return prisma.questionBank.findMany({
        where,
        take: limit,
        orderBy: { title: "asc" },
    });
};
exports.listBankProblems = listBankProblems;
