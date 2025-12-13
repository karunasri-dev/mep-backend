// routes/event.routes.js
import express from "express";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEventById,
} from "../controllers/event.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.use(restrictTo("admin"));

router.post("/", createEvent);
router.patch("/:id", updateEvent);
router.delete("/:id", deleteEvent);
router.get("/", getAllEvents);
router.get("/:id", getEventById);

export default router;
