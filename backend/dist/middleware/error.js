"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
const ERROR_CODE_TO_STATUS = {
    EMAIL_IN_USE: 409,
    INVALID_CREDENTIALS: 401,
    ROOM_NOT_FOUND: 404,
    UNSUPPORTED_LANGUAGE: 400,
    SANDBOX_ERROR: 502,
};
/**
 * Centered error handling middleware that captures all uncaught exceptions
 * and sends standardized error responses.
 */
const errorHandler = (err, req, res, next) => {
    // Always log the full stack trace on the server for internal monitoring/debugging
    console.error(`[Error Handler] Path: ${req.method} ${req.originalUrl}`);
    console.error(err);
    let statusCode = 500;
    let message = "An unexpected server error occurred.";
    let errorDetails = null;
    if (err instanceof errors_1.AppError) {
        statusCode = err.statusCode;
        message = err.message;
        errorDetails = err.details;
    }
    else if (err instanceof zod_1.ZodError) {
        statusCode = 400;
        message = "Validation failed.";
        errorDetails = err.flatten();
    }
    else if (err.code && ERROR_CODE_TO_STATUS[err.code]) {
        statusCode = ERROR_CODE_TO_STATUS[err.code];
        message = err.message;
    }
    else if (typeof err.status === "number") {
        statusCode = err.status;
        message = err.message || message;
    }
    else if (typeof err.statusCode === "number") {
        statusCode = err.statusCode;
        message = err.message || message;
    }
    else if (err instanceof Error) {
        message = err.message;
    }
    // Check if res.error decorator is mounted
    if (typeof res.error === "function") {
        return res.error(message, statusCode, errorDetails || err);
    }
    // Fallback if decorator is missing
    return res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== "production" && {
            error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        }),
    });
};
exports.errorHandler = errorHandler;
