import Team from "../models/Team.model.js";
import AppError from "../utils/AppError.js";
import TeamAudit from "../models/TeamAudit.model.js";

/**
 * USER: Create Team (PENDING)
 * POST /api/teams
 */
export const createTeam = async (req, res, next) => {
  try {
    const { teamName, bulls } = req.body;

    // Basic validation
    if (!teamName || !Array.isArray(bulls) || bulls.length === 0) {
      return next(new AppError("Team name and bulls are required", 400));
    }

    // Normalize input
    const normalizedTeamName = teamName.trim();

    const normalizedBulls = bulls.map((bull) => ({
      name: bull.name?.trim(),
      category: bull.category?.toLowerCase(),
    }));

    // Create team
    const team = await Team.create({
      teamName: normalizedTeamName,
      bulls: normalizedBulls,
      createdBy: req.user._id,
      status: "PENDING",
    });

    // Audit log
    await TeamAudit.create({
      team: team._id,
      action: "CREATED",
      performedBy: req.user._id,
    });

    //  Response
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

    const update = {
      status: decision,
    };

    if (decision === "APPROVED") {
      update.approvedBy = req.user._id;
      update.approvedAt = new Date();
    }

    const team = await Team.findOneAndUpdate(
      { _id: teamId, status: "PENDING" }, // guard condition
      { $set: update },
      { new: true }
    );

    if (!team) {
      return next(new AppError("Team not found or already decided", 404));
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
      results: teams.length,
      data: teams,
    });
  } catch (err) {
    next(err);
  }
};
