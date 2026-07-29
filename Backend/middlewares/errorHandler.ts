import { Request, Response, NextFunction } from "express";
import { Logger } from "../utils/logger";
import { ResponseHandler } from "../utils/response";

export default function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  Logger.error(`API Exception on ${req.method} ${req.url}:`, {
    message: err.message,
    stack: err.stack
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || "An unexpected system error occurred.";
  
  return ResponseHandler.error(
    res,
    message,
    statusCode,
    process.env.NODE_ENV === "development" ? err.stack : null
  );
}
