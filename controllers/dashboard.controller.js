import Team from "../models/Team.model.js";
import Event from "../models/Event.model.js";

// GET /api/dashboard/counts
export const getDashboardCounts = async (req, res, next) => {
  try {
    // Get active teams count
    const activeTeamsCount = await Team.countDocuments();

    // Get active bulls count (each bullPair has 2 bulls)
    const teams = await Team.find({}, { bullPairs: 1 });
    const activeBullsCount =
      teams.reduce((acc, team) => acc + team.bullPairs.length, 0) * 2;

    // Get events count
    const eventsCount = await Event.countDocuments();

    res.status(200).json({
      status: "success",
      data: {
        activeTeams: activeTeamsCount,
        activeBulls: activeBullsCount,
        totalEvents: eventsCount,
      },
    });
  } catch (err) {
    next(err);
  }
};
