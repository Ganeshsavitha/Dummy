import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ENV } from "../config/env";
import { Logger } from "../utils/logger";
import errorHandler from "../middlewares/errorHandler";

import authRoutes from "../routes/authRoutes";
import profileRoutes from "../routes/profileRoutes";
import healthRoutes from "../routes/healthRoutes";

const app = express();

// Enable Helmet security headers & CORS policy
app.use(helmet());
app.use(cors());
app.use(express.json());

// API Rate Limiting to prevent DoS attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests. Please try again after 15 minutes."
  }
});
app.use("/api/", limiter);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api", healthRoutes);

// Fallback for 404 routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.url}`
  });
});

// Centralized Error Handling
app.use(errorHandler);

const PORT = ENV.PORT;
app.listen(PORT, () => {
  Logger.info(`Enterprise server running successfully on http://localhost:${PORT}`);
});
