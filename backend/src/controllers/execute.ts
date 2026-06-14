import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as executeService from "../services/execute";

const executeSchema = z.object({
  sourceCode: z.string().min(1),
  language: z.string(),
});

/**
 * Handles incoming sandbox code compilation and run requests.
 */
export const execute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceCode, language } = executeSchema.parse(req.body);

    const result = await executeService.executeCode(sourceCode, language);
    return res.success(result);
  } catch (error) {
    next(error);
  }
};

