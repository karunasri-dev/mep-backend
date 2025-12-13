// app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import userRoutes from "./routes/auth.routes.js";
import { globalErrorHandler } from "./controllers/error.controller.js";

const app = express();

// app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));
// app.use(express.urlencoded({ extended: true }));

// app.use(
//   mongoSanitize({
//     replaceWith: undefined,
//   })
// );

// app.use(xss());

// routes
app.use("/api/auth", userRoutes);

// global error handler - must be after routes
app.use(globalErrorHandler);

export default app;
