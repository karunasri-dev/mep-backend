import mongoose from "mongoose";

/**
 * Embedded Bull Schema
 * Bulls do NOT exist outside a team.
 */
const bullSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["DENTITION", "AGE_GROUP", "CLASS"],
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const bullPairSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
  },

  bullA: {
    type: bullSchema,
    required: true,
  },

  bullB: {
    type: bullSchema,
    required: true,
  },

  category: {
    type: categorySchema,
    required: true,
  },
});

/**
 * Bull category validation
 */
bullPairSchema.pre("validate", function () {
  // Bulls in a pair must be different
  if (this.bullA.name === this.bullB.name) {
    throw new Error("Bull pair must contain two different bulls");
  }

  const allowedMap = {
    DENTITION: ["MILK", "TWO", "FOUR", "SIX"],
    AGE_GROUP: ["SUB_JUNIOR", "JUNIOR", "SENIOR"],
    CLASS: ["GENERAL", "NEW", "OLD"],
  };

  const allowedValues = allowedMap[this.category.type];

  if (!allowedValues || !allowedValues.includes(this.category.value)) {
    throw new Error(
      `Invalid ${this.category.type} value: ${this.category.value}`
    );
  }
});

/**
 * Embedded Team Member Schema
 */
const teamMemberSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50,
  },

  role: {
    type: String,
    enum: ["OWNER", "CAPTAIN", "DRIVER", "TRAINER", "HELPER"],
    default: "HELPER",
  },

  info: {
    type: String,
    trim: true,
    maxlength: 200,
  },

  phone: {
    type: String,
    match: /^[6-9]\d{9}$/,
  },
});

/**
 * Team Schema
 */
const teamSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    bullPairs: {
      type: [bullPairSchema],
      validate: [
        {
          validator: (v) => Array.isArray(v) && v.length > 0,
          message: "At least one bull pair is required",
        },
        {
          validator: (v) => v.length <= 10,
          message: "Maximum 10 bulls pairs allowed",
        },
      ],
    },

    teamMembers: {
      type: [teamMemberSchema],
      validate: [
        {
          validator: (v) => Array.isArray(v) && v.length >= 1,
          message: "At least one team member is required",
        },
        {
          validator: (v) => v.length <= 20,
          message: "Maximum 20 team members allowed",
        },
      ],
    },

    teamLocation: {
      type: new mongoose.Schema(
        {
          city: { type: String, trim: true },
          state: { type: String, trim: true },
          country: { type: String, trim: true },
        },
        { _id: false }
      ),
      default: undefined,
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

    rejectionReason: {
      type: String,
      maxlength: 300,
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
 * Prevent duplicate team names per user
 */
teamSchema.index({ createdBy: 1 }, { unique: true });

/**
 * Cross-field & lifecycle invariants (THROW-BASED)
 */
teamSchema.pre("save", async function () {
  // Exactly one OWNER
  const owners = this.teamMembers.filter((m) => m.role === "OWNER");
  if (owners.length !== 1) {
    throw new Error("Exactly one OWNER is required in teamMembers");
  }

  // OWNER must be creator
  const owner = owners[0];
  if (owner.userId && !owner.userId.equals(this.createdBy)) {
    throw new Error("OWNER must be the team creator");
  }

  // Approved rules
  if (this.status === "APPROVED") {
    if (!this.approvedBy) {
      throw new Error("approvedBy is required when status is APPROVED");
    }
    this.approvedAt = this.approvedAt || new Date();
  }

  // Rejected rules
  if (this.status === "REJECTED" && !this.rejectionReason) {
    throw new Error("rejectionReason is required when status is REJECTED");
  }

  // Reset approval fields if not approved
  if (this.status !== "APPROVED") {
    this.approvedBy = undefined;
    this.approvedAt = undefined;
  }
});

export default mongoose.model("Team", teamSchema);
