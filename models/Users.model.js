import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 100,
      trim: true,
    },

    mobileNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      validate: {
        validator: (v) => /^[6-9]\d{9}$/.test(v),
        message: "Invalid mobile number",
      },
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    passwordChangedAt: Date,
    tokenVersion: { type: Number, default: 0 },

    passwordResetToken: String,
    passwordResetExpires: Date,

    lastLogin: Date,
  },
  { timestamps: true }
);

// Hash password before saving

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);

  this.passwordChangedAt = Date.now() - 1000;
  this.tokenVersion += 1;
});

// Instance method to check password
userSchema.methods.correctPassword = function (candidate, hash) {
  return bcrypt.compare(candidate, hash);
};

// Check password changed after token issued
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    return this.passwordChangedAt.getTime() / 1000 > jwtTimestamp;
  }
  return false;
};
userSchema.methods.signAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      role: this.role,
    },
    process.env.JWT_ACCESS_TOKEN,
    { expiresIn: "15m" }
  );
};

userSchema.methods.signRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      tv: this.tokenVersion,
    },
    process.env.JWT_REFRESH_TOKEN,
    { expiresIn: "7d" }
  );
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

export default mongoose.model("User", userSchema);
