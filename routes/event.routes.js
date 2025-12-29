// routes/event.routes.js
import express from "express";
import {
  createEvent,
  updateEventDetails,
  deleteEvent,
  getEventById,
  updateEventState,
  getAllPublicEvents,
  addWinners,
} from "../controllers/event.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

// public
router.get("/", getAllPublicEvents);
router.get("/:id", getEventById);

router.use(protect);
router.use(restrictTo("admin"));

router.post("/", createEvent);

router.post("/:id/winners", addWinners);

router.put("/:id", updateEventDetails);

router.patch("/:id/state", updateEventState);

router.delete("/:id", deleteEvent);

export default router;
