import express from "express";
import {
  getBullPairStats,
  getTeamStats,
  getDayLeaderboard,
} from "../controllers/stats.controller.js";

const router = express.Router();

// BullPair statistics
router.get("/bullpairs", getBullPairStats);

// Team statistics
router.get("/teams", getTeamStats);

// Day leaderboard
router.get("/events/:eventId/days/:dayId/leaderboard", getDayLeaderboard);

export default router;