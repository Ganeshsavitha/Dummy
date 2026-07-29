import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { AuthValidator } from "../validators/authValidator";

const router = Router();

router.post("/register", AuthValidator.validateRegister, AuthController.register);
router.post("/login", AuthValidator.validateLogin, AuthController.login);
router.post("/logout", AuthController.logout);
router.post("/refresh-token", AuthController.refreshToken);

export default router;
