import Team from "../models/Team.model.js";
import AppError from "../utils/AppError.js";
import TeamAudit from "../models/TeamAudit.model.js";

/**
 * USER: Create Team (PENDING)
 * POST /api/teams
 */

export const createTeam = async (req, res, next) => {
  try {
    const { teamName, bullPairs, teamMembers } = req.body;

    // basic validation
    if (
      !teamName ||
      !Array.isArray(bullPairs) ||
      bullPairs.length === 0 ||
      !Array.isArray(teamMembers) ||
      teamMembers.length === 0
    ) {
      return next(new AppError("Invalid payload structure", 400));
    }

    // create team
    const team = await Team.create({
      teamName: teamName.trim(),
      bullPairs,
      teamMembers,
      createdBy: req.user._id,
      status: "PENDING", // force
    });

    // audit log
    await TeamAudit.create({
      team: team._id,
      action: "CREATED",
      performedBy: req.user._id,
    });

    res.status(201).json({
      status: "success",
      data: team,
    });
  } catch (err) {
    // Duplicate team name per user
    if (err.code === 11000) {
      return next(
        new AppError("You already created a team with this name", 409)
      );
    }
    next(err);
  }
};

/**
 * USER: Update Team
 * PATCH /api/teams/:teamId
 */
export const updateTeamRoster = async (req, res, next) => {
  try {
    const { bullPairs = [], teamMembers = [] } = req.body;

    const team = await Team.findOne({
      _id: req.params.teamId,
      createdBy: req.user._id,
      isActive: true,
    });

    if (!team) {
      return next(new AppError("Team not found", 404));
    }

    // Check if user is owner
    const owner = team.teamMembers.find(
      (m) =>
        m.role === "OWNER" && m.userId.toString() === req.user._id.toString()
    );
    if (!owner) {
      return next(new AppError("Owner missing (data corruption)", 500));
    }

    // Update fields

    // 1. Rename existing pairs
    team.bullPairs.forEach((pair, index) => {
      const incoming = bullPairs[index];
      if (!incoming) return;

      if (incoming.bullA?.name) pair.bullA.name = incoming.bullA.name;
      if (incoming.bullB?.name) pair.bullB.name = incoming.bullB.name;
      // category intentionally ignored
    });

    // 2. Add NEW pairs (if any)
    if (bullPairs.length > team.bullPairs.length) {
      const newPairs = bullPairs.slice(team.bullPairs.length);

      newPairs.forEach((pair) => {
        team.bullPairs.push({
          bullA: { name: pair.bullA.name },
          bullB: { name: pair.bullB.name },
          category: pair.category, // allowed ONLY for new pairs
        });
      });
    }

    // 3. Update team members
    const incomingNonOwners = teamMembers.filter((m) => m.role !== "OWNER");

    const existingNonOwners = team.teamMembers.filter(
      (m) => m.role !== "OWNER"
    );

    const finalMembers =
      incomingNonOwners.length > 0 ? incomingNonOwners : existingNonOwners;

    team.teamMembers = [owner, ...finalMembers];

    await team.save();

    // Audit post-approval changes
    if (team.status === "APPROVED") {
      await TeamAudit.create({
        team: team._id,
        action: "ROSTER_UPDATED",
        performedBy: req.user._id,
      });
    }

    res.status(200).json({
      status: "success",
      data: team,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Approve / Reject Team (ATOMIC)
 * PATCH /api/teams/:teamId/decision
 */
export const decideTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { decision } = req.body; // APPROVED | REJECTED

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return next(new AppError("Invalid decision", 400));
    }

    const team = await Team.findOne({ _id: teamId, status: "PENDING" });
    if (!team)
      return next(new AppError("Team not found or already decided", 404));

    if (decision === "REJECTED") {
      if (!req.body.rejectionReason) {
        return next(new AppError("Rejection reason required", 400));
      }
      team.status = "REJECTED";
      team.rejectionReason = req.body.rejectionReason;
    }

    if (decision === "APPROVED") {
      team.status = "APPROVED";
      team.approvedBy = req.user._id;
    }

    // NOTE:
    // We intentionally use `find → mutate → save()` instead of `findOneAndUpdate()`
    // because Mongoose `pre("save")` hooks do NOT run on update queries.
    // This ensures schema-level invariants (OWNER, approval rules, rejection rules)
    // are always enforced.

    await team.save();

    await TeamAudit.create({
      team: team._id,
      action: decision,
      performedBy: req.user._id,
    });

    res.status(200).json({
      status: "success",
      data: team,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Get Pending Teams (Paginated)
 * GET /api/teams/pending?page=1&limit=10
 */
export const getPendingTeams = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [teams, total] = await Promise.all([
      Team.find({ status: "PENDING", isActive: true })
        .populate("createdBy", "name mobileNumber")
        .lean()
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),

      Team.countDocuments({ status: "PENDING", isActive: true }),
    ]);

    res.status(200).json({
      status: "success",
      page,
      totalPages: Math.ceil(total / limit),
      totalResults: total,
      data: teams,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * USER: Deactivate Team (Soft Delete)
 * PATCH /api/teams/:teamId/deactivate
 */
export const deactivateTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const team = await Team.findOne({
      _id: teamId,
      createdBy: req.user._id,
      isActive: true,
    });

    if (!team) {
      return next(new AppError("Team not found or not authorized", 404));
    }

    if (team.status === "APPROVED") {
      return next(new AppError("Approved teams cannot be deactivated", 400));
    }

    team.isActive = false;
    await team.save();

    await TeamAudit.create({
      team: team._id,
      action: "DEACTIVATED",
      performedBy: req.user._id,
    });

    res.status(200).json({
      status: "success",
      message: "Team deactivated successfully",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * USER / ADMIN: Get Team by ID (Role-aware)
 * GET /api/teams/:teamId
 */
export const getTeamById = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId)
      .populate("createdBy", "name mobileNumber")
      .lean();

    if (!team) {
      return next(new AppError("Team not found", 404));
    }

    const isOwner = team.createdBy._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return next(new AppError("Not authorized to view this team", 403));
    }

    res.status(200).json({
      status: "success",
      data: team,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * USER: Get My Teams
 * GET /api/teams/mine
 */

export const getMyTeam = async (req, res, next) => {
  try {
    const team = await Team.findOne({
      isActive: true,
      status: "APPROVED",
      "teamMembers.userId": req.user._id,
    }).lean();

    if (!team) {
      return res.status(404).json({
        status: "fail",
        message: "User does not belong to any approved team",
      });
    }

    res.status(200).json({
      status: "success",
      data: team,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Get Team Audit Logs
 * GET /api/teams/:teamId/audit
 */
export const getTeamAudit = async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const logs = await TeamAudit.find({ team: teamId })
      .populate("performedBy", "name")
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({
      status: "success",
      results: logs.length,
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};

export const getActiveTeams = async (req, res, next) => {
  try {
    const teams = await Team.find({ isActive: true }).lean();
    // console.log("teams", teams);
    res.status(200).json({
      status: "success",
      results: teams.length,
      data: teams,
    });
  } catch (err) {
    next(err);
  }
};
