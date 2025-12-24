import express from "express";
import {
  createTeam,
  getMyTeams,
  getTeamById,
  deactivateTeam,
  getPendingTeams,
  decideTeam,
  getTeamAudit,
  updateTeam,
} from "../controllers/team.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * All routes below require login
 */
router.use(protect);

/* =====================================================
   USER FLOW
   ===================================================== */

/**
 * User creates a team → status = PENDING
 * POST /api/teams
 */
router.post("/", createTeam);

/**
 * User updates their team
 * PUT /api/teams/:teamId
 */
router.put("/:teamId", updateTeam);

/**
 * User fetches their teams (pending / approved / rejected)
 * GET /api/teams/my-teams
 */
router.get("/my-teams", getMyTeams);

/**
 * User deactivates their own team (only if NOT approved)
 * PATCH /api/teams/:teamId/deactivate
 */
router.patch("/:teamId/deactivate", deactivateTeam);

/* =====================================================
   ADMIN FLOW
   ===================================================== */

/**
 * Admin fetches pending teams for review
 * GET /api/teams/pending
 */
router.get("/pending", restrictTo("admin"), getPendingTeams);

/**
 * Admin approves or rejects a team
 * PATCH /api/teams/:teamId/decision
 * body: { decision: "APPROVED" | "REJECTED", rejectionReason? }
 */
router.patch("/:teamId/decision", restrictTo("admin"), decideTeam);

/**
 * Admin views audit history of a team
 * GET /api/teams/:teamId/audit
 */
router.get("/:teamId/audit", restrictTo("admin"), getTeamAudit);

/* =====================================================
   SHARED (LAST — IMPORTANT)
   ===================================================== */

/**
 * Get team details (owner or admin)
 * GET /api/teams/:teamId
 */
router.get("/:teamId", getTeamById);

export default router;
