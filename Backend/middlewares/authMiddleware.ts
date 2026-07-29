import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { ResponseHandler } from "../utils/response";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export default function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return ResponseHandler.error(res, "Access denied. No authentication token provided.", 401);
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return ResponseHandler.error(res, "Invalid token format. Must be Bearer <token>", 401);
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (error) {
    return ResponseHandler.error(res, "Authentication failed. Token is invalid or expired.", 401);
  }
}
