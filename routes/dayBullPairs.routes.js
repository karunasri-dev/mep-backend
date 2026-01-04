import express from "express";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import {
  getDayBullPairsPublic,
  updateDayBullPairStatus,
  updateDayBullPairPerformance,
  setDayBullPairWinner,
} from "../controllers/performance.controller.js";

const router = express.Router();

// Public
router.get("/:dayId/bullpairs", getDayBullPairsPublic);

// Admin controls
router.use(protect, restrictTo("admin"));
router.patch("/:id/status", updateDayBullPairStatus);
router.patch("/:id/performance", updateDayBullPairPerformance);
router.patch("/:id/winner", setDayBullPairWinner);

export default router;
