import Team from "../models/Team.model.js";
import AppError from "../utils/AppError.js";
import TeamAudit from "../models/TeamAudit.model.js";

export const createTeam = async (req, res, next) => {
  try {
    const { teamName, bulls, teamMembers } = req.body;

    // Basic intent validation (controller-level)
    if (!teamName || !bulls || !teamMembers) {
      return next(new AppError("Missing required fields", 400));
    }

    const team = await Team.create({
      teamName,
      bulls,
      teamMembers,
      createdBy: req.user._id,
      status: "PENDING", // FORCE
    });

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
    if (err.code === 11000) {
      return next(
        new AppError("You already created a team with this name", 409)
      );
    }
    next(err);
  }
};
