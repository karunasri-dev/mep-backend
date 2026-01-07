// models/EventRegistration.js
import mongoose from "mongoose";

const eventRegistrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    captainName: {
      type: String,
      required: true,
      trim: true,
    },

    contactMobile: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10}$/, "Please enter a valid 10-digit mobile number"],
    },

    // Store selected embedded bullPair IDs
    bullPairs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
    ],

    // Store actual users (these are real User IDs)
    teamMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    adminNotes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// One team can register once per event
eventRegistrationSchema.index({ event: 1, team: 1 }, { unique: true });

export default mongoose.model("EventRegistration", eventRegistrationSchema);
