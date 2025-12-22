// AUTHENTICATION MIDDLEWARE
import jwt from "jsonwebtoken";
import User from "../models/Users.model.js";
import AppError from "../utils/AppError.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    // || req.headers("Authorization")?.split(" ")[1];
    if (!token) {
      return next(new AppError("Not authenticated", 401));
    }
    // console.log("cookies........", req.cookies);

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN);
      req.user = decoded;
    } catch {
      return next(new AppError("Token expired or invalid", 401));
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError("User no longer exists", 401));
    }

    // PRIMARY: explicit invalidation
    if (user.tokenVersion !== decoded.tv) {
      return next(new AppError("Token invalidated", 401));
    }

    // SECONDARY: password timestamp
    if (user.changedPasswordAfter(decoded.iat)) {
      return next(new AppError("Password changed after token issued", 401));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// RESTRICT TO (AUTHORIZATION MIDDLEWARE)
export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError("Permission denied", 403));
    }
    next();
  };

// export const requireRole = (role) => {
//   return (req, res, next) => {
//     if (req.user.role !== role) return res.sendStatus(403);
//     next();
//   };
// };
