import * as express from "express";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string | null;
    }

    interface Response {
      success: (data: any, message?: string, statusCode?: number) => Response;
      error: (message?: string, statusCode?: number, error?: any) => Response;
    }
  }
}
