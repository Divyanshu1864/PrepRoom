import { Request, Response } from "express";
import { z } from "zod";
import * as executeService from "../services/execute";

const executeSchema = z.object({
  sourceCode: z.string().min(1),
  language: z.string(),
});

/**
 * Handles incoming sandbox code compilation and run requests.
 */
export const execute = async (req: Request, res: Response) => {
  try {
    const parsed = executeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload.", errors: parsed.error.flatten() });
    }

    const { sourceCode, language } = parsed.data;

    const result = await executeService.executeCode(sourceCode, language);
    return res.status(200).json(result);
  } catch (error: any) {
    if (error.code === "UNSUPPORTED_LANGUAGE") {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === "SANDBOX_ERROR") {
      return res.status(502).json({ message: error.message });
    }
    console.error("Execute controller error:", error);
    return res.status(500).json({ message: "Unexpected server error." });
  }
};
