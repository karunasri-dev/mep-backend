import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    eventPlace: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    timings: {
      from: {
        type: Date,
        required: true,
      },
      to: {
        type: Date,
        required: true,
      },
    },
  },
  { timestamps: true }
);

// sanity check: end date must be after start date
eventSchema.pre("validate", function () {
  if (this.timings.to <= this.timings.from) {
    throw new Error("Event end date must be after start date");
  }
});

export default mongoose.model("Event", eventSchema);
