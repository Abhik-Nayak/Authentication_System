import express from "express";
import {
  changePassword,
  forgotPassword,
  loginUser,
  logoutUser,
  registerUser,
  resendVerification,
  setup2FA,
  verification,
  verify2FA,
  verifyOTP,
} from "../controllers/userController.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { userSchema, validateUser } from "../validators/userValidate.js";

const router = express.Router();

router.post("/register", validateUser(userSchema), registerUser);
router.post("/verify", verification);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp/:email", verifyOTP);
router.post("/change-password/:email", changePassword);
router.post("/resend-verification", resendVerification);
router.post("/login", loginUser);

router.post("/2fa/setup", isAuthenticated, setup2FA);
router.post("/2fa/verify", isAuthenticated, verify2FA);


router.post("/logout", isAuthenticated, logoutUser);


export default router;
