import mongoose from "mongoose";

/**
 * Embedded Bull Schema
 * Bulls do NOT exist outside a team.
 */
const bullSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Bull name is required"],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    category: {
      type: String,
      enum: ["senior", "junior", "sub-junior"],
      required: true,
    },
  },
  { _id: false }
);

/**
 * Team Schema
 */
const teamSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    bulls: {
      type: [bullSchema],
      required: true,
      validate: [
        {
          validator: (v) => Array.isArray(v) && v.length > 0,
          message: "At least one bull is required",
        },
        {
          validator: (v) => v.length <= 10,
          message: "Maximum 10 bulls allowed",
        },
      ],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * One user cannot create two teams with the same name
 */
teamSchema.index({ teamName: 1, createdBy: 1 }, { unique: true });

/**
 * Approval invariants
 */
teamSchema.pre("save", function () {
  if (this.status === "APPROVED") {
    if (!this.approvedBy || !this.approvedAt) {
      return new Error(
        "approvedBy and approvedAt must be set when status is APPROVED"
      );
    }
  }

  if (this.status !== "APPROVED") {
    this.approvedBy = undefined;
    this.approvedAt = undefined;
  }
});

export default mongoose.model("Team", teamSchema);
