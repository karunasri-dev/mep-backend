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

router.use(protect);
router.use(restrictTo("admin"));

router.post("/", createEvent);

router.post("/:id/winners", addWinners);

router.patch("/:id", updateEventDetails);

router.patch("/:id/status", updateEventState);

router.delete("/:id", deleteEvent);

router.get("/", getAllPublicEvents);

router.get("/:id", getEventById);

export default router;
