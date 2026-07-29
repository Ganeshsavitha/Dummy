import { Router } from "express";
import { ResponseHandler } from "../utils/response";

const router = Router();

router.get("/health", (req, res) => {
  return ResponseHandler.success(
    res,
    {
      status: "UP",
      timestamp: new Date(),
      uptime: process.uptime()
    },
    "System health is operational."
  );
});

export default router;
