import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { registerForEvent, getMyRegistrationStatus } from "../controllers/eventRegistration.controller.js";
import { getEventDaysPublic } from "../controllers/performance.controller.js";

const router = express.Router();

// public
router.post("/:eventId/register", protect, registerForEvent);
router.get("/:eventId/days", getEventDaysPublic);
router.get("/:eventId/my-registration", protect, getMyRegistrationStatus);

// router.get("/admin/registrations?status=Pending", getRegistrationsByStatus);

export default router;
