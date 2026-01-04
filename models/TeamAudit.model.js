import mongoose from "mongoose";

const teamAuditSchema = new mongoose.Schema(
  {
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["CREATED", "APPROVED", "REJECTED", "ROSTER_UPDATED"],
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metadata: Object,
  },
  { timestamps: true }
);

export default mongoose.model("TeamAudit", teamAuditSchema);
