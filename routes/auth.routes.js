import express from "express";
import {
  signup,
  login,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
} from "../controllers/auth.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import { verifyUser } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", signup);
router.post("/login", login);
router.post("/forgotPassword", forgotPassword);
router.patch("/resetPassword/:token", resetPassword);

router.get("/secure", protect, (req, res) =>
  res.send("Protected route accessed")
);
router.get("/admin", protect, restrictTo("admin"), (req, res) =>
  res.send("Admin route")
);

router.get("/user", verifyUser);
router.post("/refresh", refreshAccessToken);
export default router;
