import mongoose from "mongoose";
import EventDayBullPairEntry from "../models/EventDayBullPairEntry.model.js";
import Team from "../models/Team.model.js";
import AppError from "../utils/AppError.js";

// GET /api/stats/bullpairs
export const getBullPairStats = async (req, res, next) => {
  try {
    const stats = await EventDayBullPairEntry.aggregate([
      // Only ranked (results calculated) entries
      { $match: { gameStatus: "COMPLETED", resultCalculated: true } },
      // Group by bullPairId
      {
        $group: {
          _id: "$bullPairId",
          team: { $first: "$team" }, // Keep team reference
          totalPlays: { $sum: 1 },
          podiumFinishes: {
            $sum: {
              $cond: [{ $lte: ["$rank", 3] }, 1, 0],
            },
          },
          bestRank: { $min: "$rank" },
          avgRank: { $avg: "$rank" },
          maxDistance: { $max: "$performance.distanceMeters" },
          bestTime: { $min: "$performance.timeSeconds" }, // Minimum time is best
          maxRockWeight: { $max: "$performance.rockWeightKg" },
          totalDistance: { $sum: "$performance.distanceMeters" },
          totalTime: { $sum: "$performance.timeSeconds" },
          // Category breakdown
          categories: {
            $push: {
              category: "$category.value",
              rank: "$rank",
            },
          },
        },
      },
      // Calculate averages (distance/time) + category-specific stats
      {
        $addFields: {
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
          categoryStats: {
            $map: {
              input: {
                $setUnion: ["$categories.category", []],
              },
              as: "cat",
              in: {
                category: "$$cat",
                totalPlays: {
                  $size: {
                    $filter: {
                      input: "$categories",
                      as: "c",
                      cond: { $eq: ["$$c.category", "$$cat"] },
                    },
                  },
                },
                podiums: {
                  $size: {
                    $filter: {
                      input: "$categories",
                      as: "c",
                      cond: {
                        $and: [
                          { $eq: ["$$c.category", "$$cat"] },
                          { $lte: ["$$c.rank", 3] },
                        ],
                      },
                    },
                  },
                },
                bestRank: {
                  $min: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$categories",
                          as: "c",
                          cond: { $eq: ["$$c.category", "$$cat"] },
                        },
                      },
                      as: "c2",
                      in: "$$c2.rank",
                    },
                  },
                },
                avgRank: {
                  $avg: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$categories",
                          as: "c",
                          cond: { $eq: ["$$c.category", "$$cat"] },
                        },
                      },
                      as: "c2",
                      in: "$$c2.rank",
                    },
                  },
                },
              },
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
          podiumFinishes: 1,
          bestRank: 1,
          avgRank: { $round: ["$avgRank", 2] },
          maxDistance: 1,
          bestTime: 1,
          maxRockWeight: 1,
          avgDistance: { $round: ["$avgDistance", 2] },
          avgTime: { $round: ["$avgTime", 2] },
          categoryStats: 1,
        },
      },
      // Sort by podiumFinishes desc, then avgRank asc
      { $sort: { podiumFinishes: -1, avgRank: 1 } },
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
      // Only ranked (results calculated) entries
      { $match: { gameStatus: "COMPLETED", resultCalculated: true } },
      // Group by team
      {
        $group: {
          _id: "$team",
          totalRankedEntries: { $sum: 1 },
          totalPodiums: {
            $sum: {
              $cond: [{ $lte: ["$rank", 3] }, 1, 0],
            },
          },
          avgRank: { $avg: "$rank" },
          totalDistance: { $sum: "$performance.distanceMeters" },
          totalTime: { $sum: "$performance.timeSeconds" },
          bestTime: { $min: "$performance.timeSeconds" },
          maxDistance: { $max: "$performance.distanceMeters" },
          maxRockWeight: { $max: "$performance.rockWeightKg" },
          bullPairRanks: {
            $push: {
              bullPairId: "$bullPairId",
              rank: "$rank",
            },
          },
        },
      },
      // Calculate average distance
      {
        $addFields: {
          avgDistance: {
            $cond: {
              if: { $eq: ["$totalRankedEntries", 0] },
              then: 0,
              else: { $divide: ["$totalDistance", "$totalRankedEntries"] },
            },
          },
          avgTime: {
            $cond: {
              if: { $eq: ["$totalRankedEntries", 0] },
              then: 0,
              else: { $divide: ["$totalTime", "$totalRankedEntries"] },
            },
          },
        },
      },
      // Find best bullPair (lowest average rank)
      {
        $addFields: {
          bestBullPair: {
            $reduce: {
              input: "$bullPairRanks",
              initialValue: null,
              in: {
                $cond: {
                  if: {
                    $or: [
                      { $eq: ["$$value", null] },
                      { $lt: ["$$this.rank", "$$value.rank"] },
                    ],
                  },
                  then: {
                    bullPairId: "$$this.bullPairId",
                    rank: "$$this.rank",
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
          totalRankedEntries: 1,
          totalPodiums: 1,
          avgRank: { $round: ["$avgRank", 2] },
          avgDistance: { $round: ["$avgDistance", 2] },
          avgTime: { $round: ["$avgTime", 2] },
          bestTime: 1,
          maxDistance: 1,
          maxRockWeight: 1,
          bestBullPair: "$bestBullPairName",
        },
      },
      // Sort by totalPodiums desc, then avgRank asc
      { $sort: { totalPodiums: -1, avgRank: 1 } },
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
          category: "$category.value",
          rank: "$rank",
          resultCalculated: "$resultCalculated",
        },
      },
      // Sort by category then rank if calculated; else by performance
      {
        $sort: {
          category: 1,
          rank: 1,
          distanceMeters: -1,
          timeSeconds: 1,
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      data: leaderboard,
    });
  } catch (err) {
    next(err);
  }
};
