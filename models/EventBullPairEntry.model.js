import mongoose from "mongoose";

const performanceSchema = new mongoose.Schema(
  {
    rockWeightKg: {
      type: Number,
      min: 0,
    },
    distanceMeters: {
      type: Number,
      min: 0,
    },
    timeSeconds: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

const eventBullPairEntrySchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventRegistration",
      required: true,
      index: true,
    },
    bullPairId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    gameStatus: {
      type: String,
      enum: ["NEXT", "PLAYING", "COMPLETED"],
      default: "NEXT",
      index: true,
    },
    performance: performanceSchema,
    playedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

eventBullPairEntrySchema.index({ event: 1, bullPairId: 1 }, { unique: true });

export default mongoose.model(
  "EventBullPairEntry",
  eventBullPairEntrySchema
);
