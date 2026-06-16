import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface ProblemDTO {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  roomId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Adds a new problem to the specified room.
 */
export const addProblem = async (
  roomId: string,
  title: string,
  description: string,
  difficulty: Difficulty
): Promise<ProblemDTO> => {
  return prisma.problem.create({
    data: {
      roomId,
      title,
      description,
      difficulty,
    },
  });
};

/**
 * Lists all problems belonging to a room, ordered oldest-first.
 */
export const listProblems = async (roomId: string): Promise<ProblemDTO[]> => {
  return prisma.problem.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
  });
};

/**
 * Returns a single problem by its ID.
 */
export const findProblemById = async (
  problemId: string
): Promise<ProblemDTO | null> => {
  return prisma.problem.findUnique({
    where: { id: problemId },
  });
};

/**
 * Deletes a problem by its ID.
 */
export const deleteProblem = async (problemId: string): Promise<void> => {
  await prisma.problem.delete({
    where: { id: problemId },
  });
};

export interface BankProblemDTO {
  id: string;
  questionId: string;
  title: string;
  description: string;
  difficulty: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Searches and lists questions from the Leetcode Question Bank.
 */
export const listBankProblems = async (
  search?: string,
  difficulty?: string,
  limit: number = 20
): Promise<BankProblemDTO[]> => {
  const where: any = {};
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

