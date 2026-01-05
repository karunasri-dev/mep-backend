import express from "express";
import {
  createTeam,
  getMyTeam,
  updateTeamRoster,
  getTeamById,
  deactivateTeam,
  getPendingTeams,
  decideTeam,
  getTeamAudit,
  getActiveTeams,
  getTeamsByStatus,
  getAllTeams,
} from "../controllers/team.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

// PUBLIC ROUTES (NO AUTH)

/**
 * Get all active teams
 * GET /api/teams/active
 */
router.get("/active", getActiveTeams);

/**
 * Get all teams (admin only)
 * GET /api/teams
 */
router.get("/", restrictTo("admin"), getAllTeams);

// AUTHENTICATED ROUTES
router.use(protect);

/* ================= USER FLOW ================= */

/**
 * Create team
 * POST /api/teams
 */
router.post("/", createTeam);

/**
 * Get my teams
 * GET /api/teams/my-team
 */
router.get("/my-team", getMyTeam);

/**
 * Update team roster
 * PATCH /api/teams/:teamId/roster
 */
router.patch("/:teamId/roster", updateTeamRoster);

/**
 * Deactivate own team
 * PATCH /api/teams/:teamId/deactivate
 */
router.patch("/:teamId/deactivate", deactivateTeam);

/* ================= ADMIN FLOW ================= */

router.get("/pending", restrictTo("admin"), getPendingTeams);

router.patch("/:teamId/decision", restrictTo("admin"), decideTeam);

router.get("/teams/:status", restrictTo("admin"), getTeamsByStatus);

router.get("/:teamId/audit", restrictTo("admin"), getTeamAudit);

/* ================= SHARED ================= */

/**
 * Get team by ID (owner or admin)
 * MUST BE LAST
 */
router.get("/:teamId", getTeamById);

export default router;
