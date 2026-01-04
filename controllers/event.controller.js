import Event from "../models/Event.model.js";
import EventDay from "../models/EventDay.model.js";

/**
 * CREATE EVENT (ADMIN)
 */
export const createEvent = async (req, res, next) => {
  try {
    const { title, description, location, timings, prizeMoney } = req.body;

    console.log("Event details", req.body);

    if (!title || !location || !timings || prizeMoney === undefined) {
      return res.status(400).json({
        status: "fail",
        message: "Missing required fields",
      });
    }

    // Validate location object
    if (
      typeof location !== "object" ||
      !location.name ||
      !location.googleMapUrl
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Location name and googleMapUrl are required",
      });
    }

    const event = await Event.create({
      title,
      description,
      location,
      timings,
      prizeMoney,
      createdBy: req.user.id, // ADMIN ONLY
    });

    res.status(201).json({
      status: "success",
      data: event,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE EVENT DETAILS (ADMIN)
 * Cannot update: state, winners, createdBy
 */
export const updateEventDetails = async (req, res, next) => {
  try {
    const allowedFields = [
      "title",
      "description",
      "location",
      "timings",
      "prizeMoney",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Validate location if provided
    if (updates.location !== undefined) {
      const loc = updates.location;
      if (typeof loc !== "object" || !loc.name || !loc.googleMapUrl) {
        return res.status(400).json({
          status: "fail",
          message: "Location name and googleMapUrl are required",
        });
      }
    }

    // Block editing once any day has started (ONGOING or COMPLETED)
    const started = await EventDay.exists({
      event: req.params.id,
      status: { $in: ["ONGOING", "COMPLETED"] },
    });
    if (started) {
      return res.status(400).json({
        status: "fail",
        message:
          "Event details cannot be edited after gameplay has started or completed",
      });
    }

    const event = await Event.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!event) {
      return res.status(404).json({
        status: "fail",
        message: "Event not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: event,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE EVENT STATE (ADMIN)
 * Enforces state machine
 */
export const updateEventState = async (req, res, next) => {
  try {
    const { state } = req.body;

    if (!["UPCOMING", "ONGOING", "COMPLETED"].includes(state)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid state value",
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        status: "fail",
        message: "Event not found",
      });
    }

    event.state = state;
    await event.save(); // triggers schema state validation

    res.status(200).json({
      status: "success",
      data: event,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ADD WINNERS (ADMIN)
 * Only when state === COMPLETED
 */
export const addWinners = async (req, res, next) => {
  try {
    const { winners } = req.body;

    if (!Array.isArray(winners) || winners.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Winners must be a non-empty array",
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        status: "fail",
        message: "Event not found",
      });
    }

    if (event.state !== "COMPLETED") {
      return res.status(400).json({
        status: "fail",
        message: "Winners can be added only after event completion",
      });
    }

    event.winners = winners;
    await event.save();

    res.status(200).json({
      status: "success",
      data: event,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE EVENT (ADMIN – soft delete recommended)
 */
export const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        status: "fail",
        message: "Event not found",
      });
    }

    // Block deletion if any day exists
    const hasDays = await EventDay.exists({ event: req.params.id });
    if (hasDays) {
      return res.status(400).json({
        status: "fail",
        message: "Event cannot be deleted after days are created",
      });
    }

    await event.deleteOne();

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET ALL EVENTS (PUBLIC)
 * Only UPCOMING / ONGOING
 */
export const getAllPublicEvents = async (req, res, next) => {
  try {
    const events = await Event.find({
      state: { $in: ["UPCOMING", "ONGOING"] },
    }).sort({ "timings.from": 1 });

    res.status(200).json({
      status: "success",
      data: events,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET EVENT BY ID (PUBLIC)
 */
export const getEventById = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    console.log("Event in back", event);

    if (!event) {
      return res.status(404).json({
        status: "fail",
        message: "Event not found",
      });
    }

    // hide future internal events from public
    // if (event.state === "UPCOMING") {
    //   return res.status(403).json({
    //     status: "fail",
    //     message: "Event not available",
    //   });
    // }

    res.status(200).json({
      status: "success",
      data: event,
    });
  } catch (err) {
    next(err);
  }
};
