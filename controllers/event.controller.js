// controllers/event.controller.js
import Event from "../models/Event.model.js";

export const createEvent = async (req, res, next) => {
  try {
    const { eventName, eventPlace, timings } = req.body;

    const event = await Event.create({
      eventName,
      eventPlace,
      timings,
    });

    res.status(201).json({
      status: "success",
      data: event,
    });
  } catch (err) {
    next(err);
  }
};

export const updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
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

export const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({
        status: "fail",
        message: "Event not found",
      });
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllEvents = async (req, res, next) =>
  Event.find()
    .then((events) => {
      res.status(200).json({
        status: "success",
        data: events,
      });
    })
    .catch((err) => {
      next(err);
    });

export const getEventById = async (req, res, next) =>
  Event.findById(req.params.id)
    .then((event) => {
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
    })
    .catch((err) => {
      next(err);
    });

export default {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEventById,
};
