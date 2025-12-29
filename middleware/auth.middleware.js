// AUTHENTICATION MIDDLEWARE
import jwt from "jsonwebtoken";
import User from "../models/Users.model.js";
import AppError from "../utils/AppError.js";

export const protect = async (req, res, next) => {
  try {
    if (req.method === "OPTIONS") return res.sendStatus(204);

    const token =
      req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

    // console.log("Cookies", req.cookies);
    // console.log("checking Token at protect", token);

    if (!token) {
      return next(new AppError("Not authenticated", 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN);
    } catch {
      return next(new AppError("Token expired or invalid", 401));
    }

    const user = await User.findById(decoded.id);

    // console.log("DB tokenVersion:", user.tokenVersion);
    // console.log("Token tv:", decoded.tv);
    // console.log("Auth header:", req.headers.authorization);
    // console.log("Cookie token exists:", !!req.cookies.accessToken);

    if (!user) {
      return next(new AppError("User no longer exists", 401));
    }

    if (user.tokenVersion !== decoded.tv) {
      return next(new AppError("Token invalidated", 401));
    }

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
    // console.log("Restricted too", req.user);
    console.log("Restricted too roles", roles);
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
