import express from "express";
import {
  changePassword,
  deleteUserById,
  forgotPassword,
  getAllUsers,
  loginUser,
  logoutUser,
  registerUser,
  resendVerification,
  setup2FA,
  verification,
  verify2FA,
  verify2FALogin,
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

// Multi Factor route setup
router.post("/2fa/setup", isAuthenticated, setup2FA);
router.post("/2fa/verify", isAuthenticated, verify2FA);
router.post("/2fa/login", verify2FALogin);



router.post("/logout", isAuthenticated, logoutUser);

// Testing routes
router.get("/all", getAllUsers);
router.delete("/:id", deleteUserById);

export default router;
