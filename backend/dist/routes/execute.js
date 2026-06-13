"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const rate_limit_1 = require("../middleware/rate-limit");
const router = (0, express_1.Router)();
const executeSchema = zod_1.z.object({
    sourceCode: zod_1.z.string().min(1),
    language: zod_1.z.string(),
});
const LANGUAGE_MAPPING = {
    python: 71, // Python (3.8.1)
    javascript: 93, // JavaScript (Node.js 18.15.0)
    "c++": 54, // C++ (GCC 9.2.0)
    cpp: 54,
    java: 62, // Java (OpenJDK 13.0.1)
};
// POST /api/execute - Runs user code on Judge0 CE
// Rate limit: 5 execution requests per minute per IP address
router.post("/", auth_1.requireAuth, (0, rate_limit_1.rateLimiter)({
    windowMs: 60000,
    max: 5,
    message: "Too many code execution runs. Please wait a minute.",
}), async (req, res) => {
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
        const data = (await response.json());
        return res.status(200).json({
            stdout: data.stdout,
            stderr: data.stderr,
            compile_output: data.compile_output,
            message: data.message,
            status: data.status,
            time: data.time,
            memory: data.memory,
        });
    }
    catch (error) {
        console.error("Code execution error:", error);
        return res.status(500).json({ message: "Unexpected server error." });
    }
});
exports.default = router;
