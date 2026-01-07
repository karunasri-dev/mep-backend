import Event from "../models/Event.model.js";
import EventRegistration from "../models/EventRegistration.model.js";
import TeamPerformance from "../models/TeamPerformance.model.js";
import BullPerformance from "../models/BullPerformance.model.js";
import EventBullPairEntry from "../models/EventBullPairEntry.model.js";
import Team from "../models/Team.model.js";
import EventDay from "../models/EventDay.model.js";
import EventDayBullPairEntry from "../models/EventDayBullPairEntry.model.js";
import mongoose from "mongoose";

/**
 * GET APPROVED TEAMS (Public)
 * Returns teams in registration order
 * Includes 'hasPlayed' flag
 */
export const getApprovedTeams = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    console.log("eventId", eventId);

    // 1. Get all approved registrations sorted by creation time
    const registrations = await EventRegistration.find({
      event: eventId,
      status: "APPROVED",
    })
      .populate("team", "teamName teamMembers bullPairs")
      .populate("registeredBy", "username")
      .sort({ createdAt: 1 });

    // 2. Get all performance records for this event to check who played
    const performances = await TeamPerformance.find({ event: eventId }).select(
      "team"
    );
    const playedTeamIds = new Set(performances.map((p) => p.team.toString()));

    // 3. Map to response format
    const teams = registrations.map((reg, index) => ({
      registrationId: reg._id,
      team: reg.team,
      captainName: reg.captainName,
      registrationOrder: index + 1,
      hasPlayed: playedTeamIds.has(reg.team._id.toString()),
      selectedBullPairs: (reg.bullPairs || []).map((bp) => bp.toString()),
    }));

    res.status(200).json({
      status: "success",
      data: teams,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET LEADERBOARD (Public)
 * Sorted by Distance (DESC), Time (ASC), Rock Weight (DESC)
 */
export const getLeaderboard = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const leaderboard = await TeamPerformance.find({ event: eventId })
      .populate("team", "teamName")
      .sort({ distanceCovered: -1, timeTaken: 1, rockWeight: -1 });

    res.status(200).json({
      status: "success",
      data: leaderboard,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * RECORD TEAM PERFORMANCE (Admin/Official)
 */
export const recordTeamPerformance = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { teamId, distanceCovered, timeTaken, rockWeight } = req.body;

    // 1. Validate Event Status
    const event = await Event.findById(eventId);
    if (!event) {
      return res
        .status(404)
        .json({ status: "fail", message: "Event not found" });
    }
    // Allow performance recording if event is ONGOING (LIVE)
    if (event.state !== "ONGOING") {
      return res.status(400).json({
        status: "fail",
        message:
          "Performance can only be recorded when event is LIVE (ONGOING)",
      });
    }

    // 2. Validate Team Approval
    const registration = await EventRegistration.findOne({
      event: eventId,
      team: teamId,
      status: "APPROVED",
    });

    if (!registration) {
      return res.status(400).json({
        status: "fail",
        message: "Team is not approved for this event",
      });
    }

    // 3. Check for Duplicate Performance
    const existing = await TeamPerformance.findOne({
      event: eventId,
      team: teamId,
    });
    if (existing) {
      return res.status(400).json({
        status: "fail",
        message: "Performance already recorded for this team",
      });
    }

    // 4. Calculate Registration Order
    // (Count how many approved registrations were created before this one)
    const order = await EventRegistration.countDocuments({
      event: eventId,
      status: "APPROVED",
      createdAt: { $lt: registration.createdAt },
    });
    const registrationOrder = order + 1;

    // 5. Create Performance Record
    const performance = await TeamPerformance.create({
      event: eventId,
      team: teamId,
      registrationOrder,
      distanceCovered,
      timeTaken,
      rockWeight,
      recordedBy: req.user._id,
    });

    res.status(201).json({
      status: "success",
      data: performance,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * RECORD BULL PERFORMANCE (Admin/Official)
 */
export const recordBullPerformance = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { teamId, bullName, distanceCovered, timeTaken, rockWeight } =
      req.body;

    const performance = await BullPerformance.create({
      event: eventId,
      team: teamId,
      bullName,
      distanceCovered,
      timeTaken,
      rockWeight,
    });

    res.status(201).json({
      status: "success",
      data: performance,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Ensure EventBullPairEntry documents exist for approved registrations
 */
const ensureBullPairEntries = async (eventId) => {
  const registrations = await EventRegistration.find({
    event: eventId,
    status: "APPROVED",
  }).select("_id team bullPairs");

  const ops = [];
  for (const reg of registrations) {
    for (const bpId of reg.bullPairs || []) {
      ops.push(
        EventBullPairEntry.updateOne(
          { event: eventId, bullPairId: bpId },
          {
            $setOnInsert: {
              event: eventId,
              team: reg.team,
              registration: reg._id,
              bullPairId: bpId,
              gameStatus: "NEXT",
            },
          },
          { upsert: true }
        )
      );
    }
  }
  if (ops.length > 0) {
    await Promise.all(ops);
  }
};

/**
 * Helper to attach bullPair summary from embedded Team.bullPairs
 */
const attachBullPairSummary = async (entries) => {
  const teamIds = [...new Set(entries.map((e) => e.team.toString()))];
  const teams = await Team.find({ _id: { $in: teamIds } }).select(
    "_id teamName bullPairs"
  );
  const teamMap = new Map(teams.map((t) => [t._id.toString(), t]));

  return entries.map((e) => {
    const teamDoc = teamMap.get(e.team.toString());
    let bullPairInfo = null;
    if (teamDoc) {
      const bp = (teamDoc.bullPairs || []).find((bp) =>
        bp._id.equals(e.bullPairId)
      );
      if (bp) {
        bullPairInfo = {
          name: `${bp.bullA?.name} & ${bp.bullB?.name}`,
          category: bp.category,
        };
      }
    }
    return {
      ...e.toObject(),
      team: teamDoc
        ? { _id: teamDoc._id, teamName: teamDoc.teamName }
        : { _id: e.team },
      bullPair: bullPairInfo,
    };
  });
};

/**
 * ADMIN: Get bullPair entries for event (creates missing ones)
 */
export const getEventBullPairEntriesAdmin = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    await ensureBullPairEntries(eventId);
    const entries = await EventBullPairEntry.find({ event: eventId }).sort({
      createdAt: 1,
    });
    const enriched = await attachBullPairSummary(entries);

    res.status(200).json({ status: "success", data: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * PUBLIC: Get approved bullPair entries for event (sorted day-wise)
 */
export const getEventBullPairEntriesPublic = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    await ensureBullPairEntries(eventId);
    const entries = await EventBullPairEntry.find({ event: eventId });
    const enriched = await attachBullPairSummary(entries);

    const statusOrder = { COMPLETED: 2, PLAYING: 1, NEXT: 0 };
    enriched.sort((a, b) => {
      const aPlayed = a.playedAt ? 0 : 1;
      const bPlayed = b.playedAt ? 0 : 1;
      if (aPlayed !== bPlayed) return aPlayed - bPlayed;
      const aTime = a.playedAt ? new Date(a.playedAt).getTime() : Infinity;
      const bTime = b.playedAt ? new Date(b.playedAt).getTime() : Infinity;
      if (aTime !== bTime) return aTime - bTime;
      return statusOrder[b.gameStatus] - statusOrder[a.gameStatus];
    });

    res.status(200).json({ status: "success", data: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Update game status for a bullPair entry
 */
export const updateBullPairGameStatus = async (req, res, next) => {
  try {
    const { eventId, entryId } = req.params;
    const { status } = req.body;
    if (!["NEXT", "PLAYING", "COMPLETED"].includes(status)) {
      return res
        .status(400)
        .json({ status: "fail", message: "Invalid status value" });
    }

    const entry = await EventBullPairEntry.findOne({
      _id: entryId,
      event: eventId,
    });
    if (!entry) {
      return res
        .status(404)
        .json({ status: "fail", message: "Entry not found" });
    }

    const validTransitions = {
      NEXT: ["PLAYING"],
      PLAYING: ["COMPLETED"],
      COMPLETED: [],
    };
    if (!validTransitions[entry.gameStatus].includes(status)) {
      return res.status(400).json({
        status: "fail",
        message: `Invalid transition ${entry.gameStatus} → ${status}`,
      });
    }

    entry.gameStatus = status;
    if (status === "PLAYING" && !entry.playedAt) {
      entry.playedAt = new Date();
    }
    await entry.save();
    const enriched = (await attachBullPairSummary([entry]))[0];

    res.status(200).json({ status: "success", data: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Update performance for a bullPair entry (only when PLAYING)
 */
export const updateBullPairPerformance = async (req, res, next) => {
  try {
    const { eventId, entryId } = req.params;
    const { rockWeightKg, distanceMeters, timeSeconds } = req.body || {};

    const entry = await EventBullPairEntry.findOne({
      _id: entryId,
      event: eventId,
    });
    if (!entry) {
      return res
        .status(404)
        .json({ status: "fail", message: "Entry not found" });
    }

    if (entry.gameStatus !== "PLAYING") {
      return res.status(400).json({
        status: "fail",
        message: "Performance can only be recorded when PLAYING",
      });
    }

    entry.performance = {
      rockWeightKg,
      distanceMeters,
      timeSeconds,
    };
    await entry.save();
    const enriched = (await attachBullPairSummary([entry]))[0];

    res.status(200).json({ status: "success", data: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Create EventDay
 */
export const createEventDay = async (req, res, next) => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { eventId } = req.params;
      const { date, prizeMoney } = req.body;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ status: "fail", message: "Valid YYYY-MM-DD date required" });
      }
      if (prizeMoney === undefined) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ status: "fail", message: "prizeMoney is required" });
      }
      const exists = await EventDay.findOne({ event: eventId, date }).session(
        session
      );
      if (exists) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ status: "fail", message: "Event day already exists" });
      }
      const event = await Event.findById(eventId).session(session);
      if (!event) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ status: "fail", message: "Event not found" });
      }
      if (event.state === "COMPLETED") {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "fail",
          message: "Cannot create days after event completion",
        });
      }
      const day = await EventDay.create(
        [
          {
            event: eventId,
            date,
            prizeMoney,
            status: "UPCOMING",
          },
        ],
        { session }
      );
      await session.commitTransaction();
      session.endSession();
      res.status(201).json({ status: "success", data: day[0] });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      next(err);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Get EventDays for an event
 */
export const getEventDaysAdmin = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const days = await EventDay.find({ event: eventId }).sort({ date: 1 });
    res.status(200).json({ status: "success", data: days });
  } catch (err) {
    next(err);
  }
};

/**
 * PUBLIC: Get EventDays for an event
 */
export const getEventDaysPublic = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const days = await EventDay.find({ event: eventId }).sort({ date: 1 });
    res.status(200).json({ status: "success", data: days });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Update EventDay status
 */
export const updateEventDayStatus = async (req, res, next) => {
  try {
    const { dayId } = req.params;
    const { status } = req.body;
    if (!["UPCOMING", "ONGOING", "COMPLETED"].includes(status)) {
      return res
        .status(400)
        .json({ status: "fail", message: "Invalid status value" });
    }
    const day = await EventDay.findById(dayId);
    if (!day) {
      return res
        .status(404)
        .json({ status: "fail", message: "EventDay not found" });
    }
    const validTransitions = {
      UPCOMING: ["ONGOING"],
      ONGOING: ["COMPLETED"],
      COMPLETED: [],
    };
    if (!validTransitions[day.status].includes(status)) {
      return res.status(400).json({
        status: "fail",
        message: `Invalid transition ${day.status} → ${status}`,
      });
    }
    day.status = status;
    await day.save();
    res.status(200).json({ status: "success", data: day });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Add bullPairs to EventDay
 * body: entries: [{ registrationId, teamId, bullPairId }]
 */
export const addBullPairsToDay = async (req, res, next) => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { dayId } = req.params;
      const { entries } = req.body || {};
      if (!Array.isArray(entries) || entries.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ status: "fail", message: "entries array required" });
      }
      const day = await EventDay.findById(dayId).session(session);
      if (!day) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ status: "fail", message: "EventDay not found" });
      }
      if (day.status === "COMPLETED") {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "fail",
          message: "BullPairs cannot be added after day completion",
        });
      }
      for (const item of entries) {
        const { registrationId, teamId, bullPairId } = item;
        const reg = await EventRegistration.findOne({
          _id: registrationId,
          event: day.event,
          team: teamId,
          status: "APPROVED",
        })
          .session(session)
          .select("_id bullPairs");
        if (!reg) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            status: "fail",
            message: "Invalid or unapproved registration for entry",
          });
        }
        if (!reg.bullPairs.map((b) => b.toString()).includes(bullPairId)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            status: "fail",
            message: "bullPairId not part of registration",
          });
        }

        // Fetch team to snapshot category
        const teamDoc = await Team.findById(teamId).session(session);
        if (!teamDoc) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            status: "fail",
            message: "Team not found",
          });
        }
        const bullPairObj = teamDoc.bullPairs.find(
          (bp) => bp._id.toString() === bullPairId
        );
        if (!bullPairObj) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            status: "fail",
            message: "BullPair not found in team",
          });
        }

        const activeElsewhere = await EventDayBullPairEntry.findOne({
          bullPairId,
        })
          .session(session)
          .populate("eventDay", "status");
        if (
          activeElsewhere &&
          activeElsewhere.eventDay &&
          activeElsewhere.eventDay.status === "ONGOING" &&
          ["NEXT", "PLAYING"].includes(activeElsewhere.gameStatus)
        ) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            status: "fail",
            message: "BullPair is active in another ongoing day",
          });
        }
        await EventDayBullPairEntry.updateOne(
          { eventDay: dayId, bullPairId },
          {
            $setOnInsert: {
              event: day.event,
              eventDay: dayId,
              team: teamId,
              registration: registrationId,
              bullPairId,
              gameStatus: "NEXT",
              isWinner: false,
              category: bullPairObj.category, // Snapshot category
              resultCalculated: false,
            },
          },
          { upsert: true, session }
        );
      }
      await session.commitTransaction();
      session.endSession();
      const created = await EventDayBullPairEntry.find({ eventDay: dayId });
      const enriched = await attachBullPairSummary(created);
      res.status(201).json({ status: "success", data: enriched });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      next(err);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * PUBLIC: Get bullPairs for a day
 */
export const getDayBullPairsPublic = async (req, res, next) => {
  try {
    const { dayId } = req.params;
    const entries = await EventDayBullPairEntry.find({ eventDay: dayId });
    const enriched = await attachBullPairSummary(entries);
    enriched.sort((a, b) => {
      const aTime = a.playedAt ? new Date(a.playedAt).getTime() : Infinity;
      const bTime = b.playedAt ? new Date(b.playedAt).getTime() : Infinity;
      if (aTime !== bTime) return aTime - bTime;
      const order = { COMPLETED: 2, PLAYING: 1, NEXT: 0 };
      return order[b.gameStatus] - order[a.gameStatus];
    });
    res.status(200).json({ status: "success", data: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Update day-bullpair status
 */
export const updateDayBullPairStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["NEXT", "PLAYING", "COMPLETED"].includes(status)) {
      return res
        .status(400)
        .json({ status: "fail", message: "Invalid status value" });
    }
    const entry = await EventDayBullPairEntry.findById(id);
    if (!entry) {
      return res
        .status(404)
        .json({ status: "fail", message: "Entry not found" });
    }
    if (entry.resultCalculated) {
      return res.status(400).json({
        status: "fail",
        message: "Cannot change status after results calculated",
      });
    }
    const day = await EventDay.findById(entry.eventDay);
    if (!day || day.status !== "ONGOING") {
      return res.status(400).json({
        status: "fail",
        message: "Gameplay actions allowed only when day is ONGOING",
      });
    }
    const validTransitions = {
      NEXT: ["PLAYING"],
      PLAYING: ["COMPLETED"],
      COMPLETED: [],
    };
    if (!validTransitions[entry.gameStatus].includes(status)) {
      return res.status(400).json({
        status: "fail",
        message: `Invalid transition ${entry.gameStatus} → ${status}`,
      });
    }
    // Optional rule: only one PLAYING entry per day
    if (status === "PLAYING") {
      const playingExists = await EventDayBullPairEntry.exists({
        eventDay: entry.eventDay,
        gameStatus: "PLAYING",
        _id: { $ne: entry._id },
      });
      if (playingExists) {
        return res.status(400).json({
          status: "fail",
          message: "Only one bullPair can be PLAYING at a time",
        });
      }
    }

    entry.gameStatus = status;
    if (status === "PLAYING" && !entry.playedAt) {
      entry.playedAt = new Date();
    }
    try {
      await entry.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          status: "fail",
          message: "Only one bullPair can be PLAYING at a time",
        });
      }
      throw err;
    }
    const enriched = (await attachBullPairSummary([entry]))[0];
    res.status(200).json({ status: "success", data: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Update day-bullpair performance
 */
export const updateDayBullPairPerformance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rockWeightKg, distanceMeters, timeSeconds } = req.body || {};
    const entry = await EventDayBullPairEntry.findById(id);
    if (!entry) {
      return res
        .status(404)
        .json({ status: "fail", message: "Entry not found" });
    }
    if (entry.resultCalculated) {
      return res.status(400).json({
        status: "fail",
        message: "Cannot edit performance after results calculated",
      });
    }
    const day = await EventDay.findById(entry.eventDay);
    if (day && day.status === "COMPLETED") {
      return res.status(400).json({
        status: "fail",
        message: "Cannot edit performance after day completion",
      });
    }
    if (entry.isWinner) {
      return res.status(400).json({
        status: "fail",
        message: "Cannot edit performance after winner is set",
      });
    }
    if (!["PLAYING", "COMPLETED"].includes(entry.gameStatus)) {
      return res.status(400).json({
        status: "fail",
        message: "Performance can be updated only when PLAYING or COMPLETED",
      });
    }
    const values = [rockWeightKg, distanceMeters, timeSeconds];
    if (values.some((v) => v === undefined || v === null || isNaN(v))) {
      return res.status(400).json({
        status: "fail",
        message: "All performance fields are required",
      });
    }
    if (values.some((v) => Number(v) < 0)) {
      return res.status(400).json({
        status: "fail",
        message: "Performance values must be non-negative",
      });
    }
    entry.performance = {
      rockWeightKg: Number(rockWeightKg),
      distanceMeters: Number(distanceMeters),
      timeSeconds: Number(timeSeconds),
    };
    await entry.save();
    const enriched = (await attachBullPairSummary([entry]))[0];
    res.status(200).json({ status: "success", data: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Mark daily winner (enforce one winner, only after all COMPLETED)
 */
export const setDayBullPairWinner = async (req, res, next) => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { id } = req.params;
      const entry = await EventDayBullPairEntry.findById(id).session(session);
      if (!entry) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ status: "fail", message: "Entry not found" });
      }
      const dayId = entry.eventDay;
      const day = await EventDay.findById(dayId).session(session);
      const allEntries = await EventDayBullPairEntry.find({
        eventDay: dayId,
      }).session(session);
      if (allEntries.some((e) => e.gameStatus !== "COMPLETED")) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "fail",
          message: "All plays must be COMPLETED before declaring winner",
        });
      }
      const existingWinner = allEntries.find((e) => e.isWinner);
      if (existingWinner && !existingWinner._id.equals(entry._id)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "fail",
          message: "Winner already set for this day",
        });
      }
      if (day && day.status === "COMPLETED" && existingWinner) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "fail",
          message: "Cannot change winner after day completion",
        });
      }
      await EventDayBullPairEntry.updateMany(
        { eventDay: dayId },
        { $set: { isWinner: false, winnerPrizeMoney: null } },
        { session }
      );
      entry.isWinner = true;
      entry.winnerPrizeMoney = day?.prizeMoney ?? null;
      await entry.save({ session });
      await session.commitTransaction();
      session.endSession();
      const enriched = (await attachBullPairSummary([entry]))[0];
      res.status(200).json({ status: "success", data: enriched });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      next(err);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * ADMIN: Calculate Results for Day (Category-wise Ranking)
 */
export const calculateDayResults = async (req, res, next) => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { dayId } = req.params;

      const day = await EventDay.findById(dayId).session(session);
      if (!day) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ status: "fail", message: "EventDay not found" });
      }

      const entries = await EventDayBullPairEntry.find({
        eventDay: dayId,
      }).session(session);

      if (entries.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ status: "fail", message: "No entries found for this day" });
      }

      const incomplete = entries.some((e) => e.gameStatus !== "COMPLETED");
      if (incomplete) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "fail",
          message: "All bullPairs must be COMPLETED before calculating results",
        });
      }

      // Allow recalculation - reset previous results
      if (entries.some((e) => e.resultCalculated)) {
        // Reset ranks and resultCalculated flag for recalculation
        await EventDayBullPairEntry.updateMany(
          { eventDay: dayId },
          { $unset: { rank: 1, resultCalculated: 1, isWinner: 1 } },
          { session }
        );
      }

      const byCategory = {};
      entries.forEach((e) => {
        const catKey = e.category?.value || "UNKNOWN";
        if (!byCategory[catKey]) byCategory[catKey] = [];
        byCategory[catKey].push(e);
      });

      for (const catKey in byCategory) {
        const catEntries = byCategory[catKey];
        // Sort: Distance DESC, Time ASC
        catEntries.sort((a, b) => {
          const distA = a.performance?.distanceMeters || 0;
          const distB = b.performance?.distanceMeters || 0;
          if (distA !== distB) return distB - distA;

          const timeA = a.performance?.timeSeconds || Infinity;
          const timeB = b.performance?.timeSeconds || Infinity;
          return timeA - timeB;
        });

        for (let i = 0; i < catEntries.length; i++) {
          const entry = catEntries[i];
          entry.rank = i + 1;
          entry.resultCalculated = true;
          entry.isWinner = false; // Deprecated
          await entry.save({ session });
        }
      }

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        status: "success",
        message: "Results calculated successfully",
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      next(err);
    }
  } catch (err) {
    next(err);
  }
};
