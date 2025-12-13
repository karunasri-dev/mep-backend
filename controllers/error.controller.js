// controllers/error.controller.js
export const globalErrorHandler = (err, req, res, next) => {
  // Normalize
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Operational errors (trusted)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // Programming or unknown error -> don't leak details
  console.error("🔥 UNEXPECTED ERROR:", err);
  return res.status(500).json({
    status: "error",
    message: "Something went wrong",
  });
};
