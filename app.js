// app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import cookieParser from "cookie-parser";

// routes
import userRoutes from "./routes/auth.routes.js";
import eventRoutes from "./routes/event.routes.js";
import teamRoutes from "./routes/team.routes.js";
import eventRegistraionRoutes from "./routes/eventRegistration.route.js";

// global error handler

import { globalErrorHandler } from "./middleware/error.middleware.js";

const app = express();
// app.use(helmet());
// app.use(cors());
app.use(
  cors({
    origin: true, // Allow any origin in development
    // origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// app.options("/*", cors());

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
// app.use(express.urlencoded({ extended: true }));

// app.use(
//   mongoSanitize({
//     replaceWith: undefined,
//   })
// );

// app.use(xss());

// routes
app.use("/api/auth", userRoutes);
app.use("/api/admin/events", eventRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/events", eventRegistraionRoutes);

// global error handler - must be after routes
app.use(globalErrorHandler);

export default app;
