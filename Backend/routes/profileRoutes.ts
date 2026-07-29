import { Router } from "express";
import { ProfileController } from "../controllers/profileController";
import authMiddleware from "../middlewares/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", ProfileController.getProfile);
router.put("/", ProfileController.updateProfile);

export default router;
