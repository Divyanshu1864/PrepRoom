import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";

const ERROR_CODE_TO_STATUS: Record<string, number> = {
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
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Always log the full stack trace on the server for internal monitoring/debugging
  console.error(`[Error Handler] Path: ${req.method} ${req.originalUrl}`);
  console.error(err);

  let statusCode = 500;
  let message = "An unexpected server error occurred.";
  let errorDetails: any = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorDetails = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation failed.";
    errorDetails = err.flatten();
  } else if (err.code && ERROR_CODE_TO_STATUS[err.code]) {
    statusCode = ERROR_CODE_TO_STATUS[err.code];
    message = err.message;
  } else if (typeof err.status === "number") {
    statusCode = err.status;
    message = err.message || message;
  } else if (typeof err.statusCode === "number") {
    statusCode = err.statusCode;
    message = err.message || message;
  } else if (err instanceof Error) {
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
