const LANGUAGE_MAPPING: Record<string, number> = {
  python: 71,       // Python (3.8.1)
  javascript: 93,   // JavaScript (Node.js 18.15.0)
  "c++": 54,        // C++ (GCC 9.2.0)
  cpp: 54,
  java: 62,         // Java (OpenJDK 13.0.1)
};

export interface ExecuteResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null;
}

/**
 * Sends source code to the remote Judge0 sandbox environment for execution.
 */
export const executeCode = async (sourceCode: string, language: string): Promise<ExecuteResult> => {
  const languageId = LANGUAGE_MAPPING[language.toLowerCase()];

  if (!languageId) {
    const error = new Error(`Language '${language}' is not supported.`);
    (error as any).code = "UNSUPPORTED_LANGUAGE";
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
    (error as any).code = "SANDBOX_ERROR";
    throw error;
  }

  const data = (await response.json()) as any;

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
