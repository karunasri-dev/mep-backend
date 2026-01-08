import express from "express";
import {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  changePassword,
} from "../controllers/auth.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import { verifyUser } from "../controllers/auth.controller.js";
import {
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/register", signup);
router.post("/login", login);
router.post("/logout", protect, logout);
router.post("/forgotPassword", forgotPasswordLimiter, forgotPassword);
router.post("/resetPassword", resetPasswordLimiter, resetPassword);
router.post("/changePassword", protect, changePassword);

router.get("/secure", protect, (req, res) =>
  res.send("Protected route accessed")
);
router.get("/admin", protect, restrictTo("admin"), (req, res) =>
  res.send("Admin route")
);

router.get("/user", verifyUser);
router.post("/refresh", refreshAccessToken);
export default router;
