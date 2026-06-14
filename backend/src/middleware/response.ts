import { Request, Response, NextFunction } from "express";

export const responseMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.success = (data: any, message = "Success", statusCode = 200) => {
    const isPlainObject = typeof data === "object" && data !== null && !Array.isArray(data);
    return res.status(statusCode).json({
      success: true,
      message,
      ...(isPlainObject ? data : { data }),
    });
  };

  res.error = (message = "Something went wrong!", statusCode = 500, error: any = null) => {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV !== "production" &&
        error && {
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        }),
    });
  };

  next();
};

