import mongoose from "mongoose";

const performanceSchema = new mongoose.Schema(
  {
    rockWeightKg: { type: Number, min: 0 },
    distanceMeters: { type: Number, min: 0 },
    timeSeconds: { type: Number, min: 0 },
  },
  { _id: false }
);

const eventDayBullPairEntrySchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    eventDay: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventDay",
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
    rank: { type: Number, min: 1 },
    category: {
      type: {
        type: String,
        enum: ["DENTITION", "AGE_GROUP", "CLASS"],
      },
      value: { type: String },
    },
    resultCalculated: { type: Boolean, default: false },
    performance: performanceSchema,
    isWinner: {
      type: Boolean,
      default: false,
      index: true,
    },
    winnerPrizeMoney: {
      type: Number,
      min: 0,
    },
    playedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

eventDayBullPairEntrySchema.index(
  { eventDay: 1, bullPairId: 1 },
  { unique: true }
);

// Enforce only one PLAYING per day at DB level
// eventDayBullPairEntrySchema.index(
//   { eventDay: 1, gameStatus: 1 },
//   { unique: true, partialFilterExpression: { gameStatus: "PLAYING" } }
// );

export default mongoose.model(
  "EventDayBullPairEntry",
  eventDayBullPairEntrySchema
);
