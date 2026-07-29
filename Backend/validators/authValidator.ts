import { Request, Response, NextFunction } from "express";
import { ResponseHandler } from "../utils/response";

export const AuthValidator = {
  validateRegister(req: Request, res: Response, next: NextFunction) {
    const { username, email, password, fullName } = req.body;
    
    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return ResponseHandler.error(res, "Username must be at least 3 characters long.", 400);
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return ResponseHandler.error(res, "Please provide a valid email address.", 400);
    }
    
    if (!password || typeof password !== "string" || password.length < 6) {
      return ResponseHandler.error(res, "Password must be at least 6 characters long.", 400);
    }
    
    if (!fullName || typeof fullName !== "string" || fullName.trim().length === 0) {
      return ResponseHandler.error(res, "Full Name is required.", 400);
    }
    
    next();
  },
  
  validateLogin(req: Request, res: Response, next: NextFunction) {
    const { username, password } = req.body;
    
    if (!username || typeof username !== "string") {
      return ResponseHandler.error(res, "Username is required.", 400);
    }
    
    if (!password || typeof password !== "string") {
      return ResponseHandler.error(res, "Password is required.", 400);
    }
    
    next();
  }
};
