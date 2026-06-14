"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCode = void 0;
const LANGUAGE_MAPPING = {
    python: 71, // Python (3.8.1)
    javascript: 93, // JavaScript (Node.js 18.15.0)
    "c++": 54, // C++ (GCC 9.2.0)
    cpp: 54,
    java: 62, // Java (OpenJDK 13.0.1)
};
/**
 * Sends source code to the remote Judge0 sandbox environment for execution.
 */
const executeCode = async (sourceCode, language) => {
    const languageId = LANGUAGE_MAPPING[language.toLowerCase()];
    if (!languageId) {
        const error = new Error(`Language '${language}' is not supported.`);
        error.code = "UNSUPPORTED_LANGUAGE";
        throw error;
    }
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
        console.error("Judge0 sandbox response error:", errorText);
        const error = new Error("Failed to compile/execute code on the sandbox server.");
        error.code = "SANDBOX_ERROR";
        throw error;
    }
    const data = (await response.json());
    return {
        stdout: data.stdout,
        stderr: data.stderr,
        compile_output: data.compile_output,
        message: data.message,
        status: data.status,
        time: data.time,
        memory: data.memory,
    };
};
exports.executeCode = executeCode;
