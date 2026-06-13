import { Router, Request, Response } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { rateLimiter } from "../middleware/rate-limit";

const router = Router();

const executeSchema = z.object({
  sourceCode: z.string().min(1),
  language: z.string(),
});

const LANGUAGE_MAPPING: Record<string, number> = {
  python: 71,       // Python (3.8.1)
  javascript: 93,   // JavaScript (Node.js 18.15.0)
  "c++": 54,        // C++ (GCC 9.2.0)
  cpp: 54,
  java: 62,         // Java (OpenJDK 13.0.1)
};

// POST /api/execute - Runs user code on Judge0 CE
// Rate limit: 5 execution requests per minute per IP address
router.post(
  "/",
  requireAuth,
  rateLimiter({
    windowMs: 60000,
    max: 5,
    message: "Too many code execution runs. Please wait a minute.",
  }),
  async (req: Request, res: Response) => {
    try {
      const parsed = executeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload.", errors: parsed.error.flatten() });
      }

      const { sourceCode, language } = parsed.data;
      const languageId = LANGUAGE_MAPPING[language.toLowerCase()];

      if (!languageId) {
        return res.status(400).json({ message: `Language '${language}' is not supported.` });
      }

      // Proxy request to Judge0 server with wait=true for synchronous response
      const response = await fetch("https://ce.judge0.com/submissions?wait=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_code: sourceCode,
          language_id: languageId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Judge0 proxy failure:", errorText);
        return res.status(502).json({ message: "Failed to compile/execute code on the sandbox server." });
      }

      const data = (await response.json()) as any;

      return res.status(200).json({
        stdout: data.stdout,
        stderr: data.stderr,
        compile_output: data.compile_output,
        message: data.message,
        status: data.status,
        time: data.time,
        memory: data.memory,
      });
    } catch (error) {
      console.error("Code execution error:", error);
      return res.status(500).json({ message: "Unexpected server error." });
    }
  }
);

export default router;
