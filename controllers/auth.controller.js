import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/Users.model.js";
import AppError from "../utils/AppError.js";
import { AuthError } from "../utils/AuthError.js";
import { sendTokens, verifyRefreshToken } from "../utils/sendTokens.js";
import { sendSMS } from "../utils/sms.js";

// SIGNUP
export const signup = async (req, res, next) => {
  try {
    const { username, mobileNumber, password } = req.body;

    if (!username || !mobileNumber || !password) {
      return next(new AppError("Missing fields", 400));
    }

    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      return next(new AppError("User already exists", 409));
    }

    const user = await User.create({
      username,
      mobileNumber,
      password,
    });

    const accessToken = user.signAccessToken();
    const refreshToken = user.signRefreshToken();

    sendTokens(res, accessToken, refreshToken);

    res.status(201).json({
      status: "success",
      data: {
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// LOGIN
export const login = async (req, res, next) => {
  try {
    const { mobileNumber, password } = req.body;

    if (!mobileNumber || !password) {
      return next(new AppError("Missing credentials", 400));
    }

    const user = await User.findOne({ mobileNumber }).select("+password");
    if (!user) {
      return next(new AppError("Invalid credentials", 401));
    }

    const isCorrect = await user.correctPassword(password, user.password);
    if (!isCorrect) {
      return next(new AppError("Invalid credentials", 401));
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const accessToken = user.signAccessToken();
    const refreshToken = user.signRefreshToken();

    sendTokens(res, accessToken, refreshToken);

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
        },
        accessToken,
      },
    });
  } catch (err) {
    console.log("Login error:", err);
    next(err);
  }
};

// REFRESH ACCESS TOKEN
export const refreshAccessToken = async (req, res, next) => {
  try {
    // console.log("REFRESH ACCESS TOKEN at controller");
    // console.log(req.cookies.refreshToken);
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return next(
        new AuthError({
          code: "NO_REFRESH_TOKEN",
        })
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN);
    } catch (err) {
      return next(
        new AuthError({
          code: "INVALID_REFRESH_TOKEN",
        })
      );
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(
        new AuthError({
          code: "USER_NOT_FOUND",
        })
      );
    }

    // CRITICAL: invalidate old refresh tokens
    if (user.tokenVersion !== decoded.tv) {
      return next(new AuthError({ code: "TOKEN_REVOKED" }));
    }

    // Rotate refresh token properly
    user.tokenVersion += 1;
    await user.save();

    const newAccessToken = user.signAccessToken();
    const newRefreshToken = user.signRefreshToken();

    sendTokens(res, newAccessToken, newRefreshToken);

    res.status(200).json({
      ok: true,
      status: "success",
      data: {
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res, next) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      return next(new AppError("mobileNumber required", 400));
    }

    const user = await User.findOne({ mobileNumber });

    // Prevent user enumeration
    if (!user) {
      return res.status(200).json({
        status: "success",
        message: "If the mobile number is registered, a reset code has been sent.",
      });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send SMS with reset token
    const message = `Your password reset code is: ${resetToken}. It expires in 10 minutes. Use it to reset your password.`;
    try {
      await sendSMS(user.mobileNumber, message);
    } catch (smsError) {
      // If SMS fails, still return success to prevent enumeration, but log error
      console.error('SMS send failed:', smsError);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return next(new AppError("Failed to send reset code. Please try again.", 500));
    }

    res.status(200).json({
      status: "success",
      message: "Reset code sent to your mobile number.",
    });
  } catch (err) {
    next(err);
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return next(new AppError("New password required", 400));
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError("Invalid or expired token", 400));
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save(); // increments tokenVersion internally

    const accessToken = user.signAccessToken();
    const refreshToken = user.signRefreshToken();

    sendTokens(res, accessToken, refreshToken);

    res.status(200).json({
      status: "success",
      message: "Password reset successful",
    });
  } catch (err) {
    next(err);
  }
};

// CHANGE PASSWORD
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(
        new AppError("Current password and new password are required", 400)
      );
    }

    // Get user with password
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if current password is correct
    const isCorrect = await user.correctPassword(
      currentPassword,
      user.password
    );
    if (!isCorrect) {
      return next(new AppError("Current password is incorrect", 400));
    }

    // Update password
    user.password = newPassword;
    await user.save(); // This will hash the password and increment tokenVersion

    // Generate new tokens
    const accessToken = user.signAccessToken();
    const refreshToken = user.signRefreshToken();
    sendTokens(res, accessToken, refreshToken);

    res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (err) {
    next(err);
  }
};

// verify me

export const verifyUser = async (req, res, next) => {
  // Prevent caching of authentication status
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = verifyRefreshToken(token);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.status(200).json({
      user: user,
    });
  } catch (err) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
};

//  LOGOUT
export const logout = async (req, res, next) => {
  try {
    // req.user is set by auth middleware
    const userId = req.user?.id;

    if (userId) {
      await User.findByIdAndUpdate(
        userId,
        { $inc: { tokenVersion: 1 } }, // revoke all tokens
        { new: true }
      );
    }

    // Clear cookies properly
    res.clearCookie("accessToken", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (err) {
    next(err);
  }
};
