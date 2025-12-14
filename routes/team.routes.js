import express from "express";
import {
  createTeam,
  getPendingTeams,
  decideTeam,
} from "../controllers/team.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protect, createTeam);

router.get("/pending", protect, restrictTo("admin"), getPendingTeams);

router.patch("/:teamId/decision", protect, restrictTo("admin"), decideTeam);

export default router;
