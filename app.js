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
import adminRegistrationRoutes from "./routes/adminEventRegistration.routes.js";
import performanceRoutes from "./routes/performance.routes.js";
import adminEventDayRoutes from "./routes/adminEventDay.routes.js";
import dayBullPairsRoutes from "./routes/dayBullPairs.routes.js";
import statsRoutes from "./routes/stats.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

// global error handler

import { globalErrorHandler } from "./middleware/error.middleware.js";

const app = express();
// app.use(helmet());
// app.use(cors());
app.use(
  cors({
    //  origin: true, // Allow any origin in development
    origin: [
      "http://localhost:5173",
      "https://manaedlapandalu.com",
      "https://www.manaedlapandalu.com",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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
app.use("/api/admin/registrations", adminRegistrationRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/admin", adminEventDayRoutes);
app.use("/api/event-days", dayBullPairsRoutes);
// alias mount for admin day-bullpairs to match frontend service paths
app.use("/api/admin/day-bullpairs", dayBullPairsRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/dashboard", dashboardRoutes);

// global error handler - must be after routes
app.use(globalErrorHandler);

export default app;
