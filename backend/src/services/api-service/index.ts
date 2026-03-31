import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";
import { errorHandler } from "./middleware/error-handler";
import { createAuthRouter } from "./routes/auth.router";
import { createSheetsRouter } from "./routes/sheets.router";
import { createUploadsRouter } from "./routes/uploads.router";
import { rabbitmq, setupQueues } from "../../lib/queue";

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(morgan("short"));

// Health check
app.get("/healthcheck", (_req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/auth", createAuthRouter(prisma));
app.use("/sheets", createSheetsRouter(prisma));
app.use("/uploads", createUploadsRouter(prisma));

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down...");
  await rabbitmq.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function start() {
  // Connect to RabbitMQ so producers can publish jobs
  await setupQueues();
  console.log("RabbitMQ connected");

  app.listen(port, () => {
    console.log(`API service listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error("API service failed to start:", err);
  process.exit(1);
});

export default app;
