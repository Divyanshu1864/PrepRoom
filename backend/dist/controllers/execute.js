"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = void 0;
const zod_1 = require("zod");
const executeService = __importStar(require("../services/execute"));
const executeSchema = zod_1.z.object({
    sourceCode: zod_1.z.string().min(1),
    language: zod_1.z.string(),
});
/**
 * Handles incoming sandbox code compilation and run requests.
 */
const execute = async (req, res) => {
    try {
        const parsed = executeSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid payload.", errors: parsed.error.flatten() });
        }
        const { sourceCode, language } = parsed.data;
        const result = await executeService.executeCode(sourceCode, language);
        return res.status(200).json(result);
    }
    catch (error) {
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
exports.execute = execute;
