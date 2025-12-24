import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/Users.model.js";
import AppError from "../utils/AppError.js";
import {
  sendTokens,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/sendTokens.js";

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
    console.log("REFRESH ACCESS TOKEN");
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return next(new AppError("No refresh token", 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN);
    } catch (err) {
      return next(new AppError("Invalid or expired refresh token", 401));
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError("User no longer exists", 401));
    }

    // CRITICAL: invalidate old refresh tokens
    if (user.tokenVersion !== decoded.tv) {
      return next(new AppError("Refresh token invalidated", 401));
    }

    // Rotate refresh token properly
    user.tokenVersion += 1;
    await user.save();

    const newAccessToken = user.signAccessToken();
    const newRefreshToken = user.signRefreshToken();

    sendTokens(res, newAccessToken, newRefreshToken);

    res.status(200).json({ status: "success" });
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
        message: "Reset token generated",
      });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    console.log("RESET TOKEN (dev only):", `/reset-password/${resetToken}`);

    res.status(200).json({
      status: "success",
      message: "Reset token generated",
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

    const userData = {
      id: user._id,
      mobileNumber: user.mobileNumber,
      username: user.username,
      role: user.role,
    };

    const newAccessToken = signAccessToken(userData);

    res.json({
      user: userData,
      accessToken: newAccessToken,
    });
  } catch (err) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
};

//  LOGOUT
export const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.tokenVersion += 1;
      await user.save({ validateBeforeSave: false });
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.status(200).json({ status: "success" });
  } catch (err) {
    next(err);
  }
};
