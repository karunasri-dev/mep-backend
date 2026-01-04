import EventRegistration from "../models/EventRegistration.model.js";

export const getRegistrationsByEvent = async (req, res, next) => {
  try {
    const { eventId } = req.query;

    console.log("eventId", eventId);

    if (!eventId) {
      return res.status(400).json({
        status: "fail",
        message: "Event ID is required",
      });
    }

    const registrations = await EventRegistration.find({ event: eventId })
      .populate("team", "teamName bullPairs")
      .populate("registeredBy", "username mobileNumber")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      data: registrations,
    });
  } catch (err) {
    next(err);
  }
};

export const updateRegistrationStatus = async (req, res, next) => {
  try {
    const { registrationId } = req.params;
    const { status, reason } = req.body;

    console.log("status", status, "reason", reason);

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid status",
      });
    }

    const registration = await EventRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        status: "fail",
        message: "Registration not found",
      });
    }

    if (registration.status !== "PENDING") {
      return res.status(400).json({
        status: "fail",
        message: "Only PENDING registrations can be updated",
      });
    }

    if (status === "REJECTED" && !reason) {
      return res.status(400).json({
        status: "fail",
        message: "Rejection reason required",
      });
    }

    registration.status = status;

    if (status === "APPROVED") {
      registration.approvedBy = req.user._id;
      registration.approvedAt = new Date();
    }

    if (reason) {
      registration.adminNotes = reason;
    }

    await registration.save();

    res.status(200).json({
      status: "success",
      data: registration,
    });
  } catch (err) {
    next(err);
  }
};
