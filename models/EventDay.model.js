import mongoose from "mongoose";

const eventDaySchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    prizeMoney: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["UPCOMING", "ONGOING", "COMPLETED"],
      default: "UPCOMING",
      index: true,
    },
  },
  { timestamps: true }
);

eventDaySchema.index({ event: 1, date: 1 }, { unique: true });

export default mongoose.model("EventDay", eventDaySchema);
