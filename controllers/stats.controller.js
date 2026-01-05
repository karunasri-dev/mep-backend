import mongoose from "mongoose";
import EventDayBullPairEntry from "../models/EventDayBullPairEntry.model.js";
import Team from "../models/Team.model.js";
import AppError from "../utils/AppError.js";

// GET /api/stats/bullpairs
export const getBullPairStats = async (req, res, next) => {
  try {
    const stats = await EventDayBullPairEntry.aggregate([
      // Only completed games
      { $match: { gameStatus: "COMPLETED" } },
      // Group by bullPairId
      {
        $group: {
          _id: "$bullPairId",
          team: { $first: "$team" }, // Keep team reference
          totalPlays: { $sum: 1 },
          totalWins: { $sum: { $cond: ["$isWinner", 1, 0] } },
          maxDistance: { $max: "$performance.distanceMeters" },
          bestTime: { $min: "$performance.timeSeconds" }, // Minimum time is best
          maxRockWeight: { $max: "$performance.rockWeightKg" },
          totalDistance: { $sum: "$performance.distanceMeters" },
          totalTime: { $sum: "$performance.timeSeconds" },
          totalPrizeWon: { $sum: "$winnerPrizeMoney" }, // Sum prize money for wins
        },
      },
      // Calculate averages and win rate
      {
        $addFields: {
          winRate: {
            $cond: {
              if: { $eq: ["$totalPlays", 0] },
              then: 0,
              else: {
                $multiply: [{ $divide: ["$totalWins", "$totalPlays"] }, 100],
              },
            },
          },
          avgDistance: {
            $cond: {
              if: { $eq: ["$totalPlays", 0] },
              then: 0,
              else: { $divide: ["$totalDistance", "$totalPlays"] },
            },
          },
          avgTime: {
            $cond: {
              if: { $eq: ["$totalPlays", 0] },
              then: 0,
              else: { $divide: ["$totalTime", "$totalPlays"] },
            },
          },
        },
      },
      // Lookup team to get bullPair details
      {
        $lookup: {
          from: "teams",
          localField: "team",
          foreignField: "_id",
          as: "teamData",
        },
      },
      { $unwind: "$teamData" },
      // Find the bullPair in the team's bullPairs array
      {
        $addFields: {
          bullPair: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$teamData.bullPairs",
                  cond: { $eq: ["$$this._id", "$_id"] },
                },
              },
              0,
            ],
          },
        },
      },
      // Project final fields
      {
        $project: {
          _id: 0,
          bullPairId: "$_id",
          bullPairName: {
            $concat: ["$bullPair.bullA.name", " - ", "$bullPair.bullB.name"],
          },
          teamName: "$teamData.teamName",
          totalPlays: 1,
          totalWins: 1,
          winRate: { $round: ["$winRate", 2] },
          maxDistance: 1,
          bestTime: 1,
          maxRockWeight: 1,
          avgDistance: { $round: ["$avgDistance", 2] },
          avgTime: { $round: ["$avgTime", 2] },
          totalPrizeWon: 1,
        },
      },
      // Sort by totalWins desc, then totalPlays desc
      { $sort: { totalWins: -1, totalPlays: -1 } },
    ]);

    res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/stats/teams
export const getTeamStats = async (req, res, next) => {
  try {
    const stats = await EventDayBullPairEntry.aggregate([
      // Only completed games
      { $match: { gameStatus: "COMPLETED" } },
      // Group by team
      {
        $group: {
          _id: "$team",
          totalBullPairPlays: { $sum: 1 },
          totalWins: { $sum: { $cond: ["$isWinner", 1, 0] } },
          totalPrizeWon: { $sum: "$winnerPrizeMoney" },
          totalDistance: { $sum: "$performance.distanceMeters" },
          bullPairStats: {
            $push: {
              bullPairId: "$bullPairId",
              distance: "$performance.distanceMeters",
              wins: { $cond: ["$isWinner", 1, 0] },
            },
          },
        },
      },
      // Calculate average distance
      {
        $addFields: {
          avgDistance: {
            $cond: {
              if: { $eq: ["$totalBullPairPlays", 0] },
              then: 0,
              else: { $divide: ["$totalDistance", "$totalBullPairPlays"] },
            },
          },
        },
      },
      // Find best bullPair (by max distance, or if tie, by wins)
      {
        $addFields: {
          bestBullPair: {
            $reduce: {
              input: "$bullPairStats",
              initialValue: null,
              in: {
                $cond: {
                  if: {
                    $or: [
                      { $eq: ["$$value", null] },
                      { $gt: ["$$this.distance", "$$value.maxDistance"] },
                      {
                        $and: [
                          { $eq: ["$$this.distance", "$$value.maxDistance"] },
                          { $gt: ["$$this.wins", "$$value.wins"] },
                        ],
                      },
                    ],
                  },
                  then: {
                    bullPairId: "$$this.bullPairId",
                    maxDistance: "$$this.distance",
                    wins: "$$this.wins",
                  },
                  else: "$$value",
                },
              },
            },
          },
        },
      },
      // Lookup team data
      {
        $lookup: {
          from: "teams",
          localField: "_id",
          foreignField: "_id",
          as: "teamData",
        },
      },
      { $unwind: "$teamData" },
      // Get bullPair name for bestBullPair
      {
        $addFields: {
          bestBullPairName: {
            $let: {
              vars: {
                bullPair: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$teamData.bullPairs",
                        cond: {
                          $eq: ["$$this._id", "$bestBullPair.bullPairId"],
                        },
                      },
                    },
                    0,
                  ],
                },
              },
              in: {
                $concat: [
                  "$$bullPair.bullA.name",
                  " - ",
                  "$$bullPair.bullB.name",
                ],
              },
            },
          },
        },
      },
      // Project final fields
      {
        $project: {
          _id: 0,
          teamId: "$_id",
          teamName: "$teamData.teamName",
          totalBullPairPlays: 1,
          totalWins: 1,
          totalPrizeWon: 1,
          avgDistance: { $round: ["$avgDistance", 2] },
          bestBullPair: "$bestBullPairName",
        },
      },
      // Sort by totalWins desc, then totalPrizeWon desc
      { $sort: { totalWins: -1, totalPrizeWon: -1 } },
    ]);

    res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/events/:eventId/days/:dayId/leaderboard
export const getDayLeaderboard = async (req, res, next) => {
  try {
    const { eventId, dayId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(eventId) ||
      !mongoose.Types.ObjectId.isValid(dayId)
    ) {
      return next(new AppError("Invalid event or day ID", 400));
    }

    const leaderboard = await EventDayBullPairEntry.aggregate([
      // Match event, day, and completed status
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          eventDay: new mongoose.Types.ObjectId(dayId),
          gameStatus: "COMPLETED",
        },
      },
      // Lookup team and bullPair details
      {
        $lookup: {
          from: "teams",
          localField: "team",
          foreignField: "_id",
          as: "teamData",
        },
      },
      { $unwind: "$teamData" },
      {
        $addFields: {
          bullPair: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$teamData.bullPairs",
                  cond: { $eq: ["$$this._id", "$bullPairId"] },
                },
              },
              0,
            ],
          },
        },
      },
      // Project fields
      {
        $project: {
          _id: 0,
          bullPair: {
            $concat: ["$bullPair.bullA.name", " - ", "$bullPair.bullB.name"],
          },
          team: "$teamData.teamName",
          distanceMeters: "$performance.distanceMeters",
          timeSeconds: "$performance.timeSeconds",
          rockWeightKg: "$performance.rockWeightKg",
          isWinner: 1,
        },
      },
      // Sort by distance desc, then time asc
      { $sort: { distanceMeters: -1, timeSeconds: 1 } },
    ]);

    res.status(200).json({
      status: "success",
      data: leaderboard,
    });
  } catch (err) {
    next(err);
  }
};
