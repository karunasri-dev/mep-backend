import express from "express";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import {
  getApprovedTeams,
  getLeaderboard,
  recordTeamPerformance,
  recordBullPerformance,
  getEventBullPairEntriesAdmin,
  getEventBullPairEntriesPublic,
  updateBullPairGameStatus,
  updateBullPairPerformance,
} from "../controllers/performance.controller.js";

const router = express.Router();

// Public Routes
router.get("/:eventId/approved-teams", getApprovedTeams);
router.get("/:eventId/leaderboard", getLeaderboard);
router.get("/:eventId/bullpairs/public", getEventBullPairEntriesPublic);

// Admin/Official Routes
router.use(protect, restrictTo("admin")); // Assuming 'admin' covers officials for now as per previous context

router.post("/:eventId/team-performance", recordTeamPerformance);
router.post("/:eventId/bull-performance", recordBullPerformance);
router.get("/:eventId/bullpairs", getEventBullPairEntriesAdmin);
router.patch("/:eventId/bullpairs/:entryId/status", updateBullPairGameStatus);
router.patch(
  "/:eventId/bullpairs/:entryId/performance",
  updateBullPairPerformance
);

export default router;
