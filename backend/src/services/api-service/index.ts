import { initSentry, Sentry } from "../../lib/monitoring";
initSentry();

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
import { createMatchesRouter } from "./routes/matches.router";
import { createPricingRouter } from "./routes/pricing.router";
import { createBillingRouter } from "./routes/billing.router";
import { createExportsRouter } from "./routes/exports.router";
import { createWebhooksRouter } from "./routes/webhooks.router";
import { rabbitmq, setupQueues } from "../../lib/queue";
import { authLimiter, uploadLimiter } from "./middleware/rate-limit";

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 8080;

// Webhooks (must be before json body parser for raw body access)
app.use("/webhooks", createWebhooksRouter(prisma));

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
app.use("/auth", authLimiter, createAuthRouter(prisma));
app.use("/sheets", createSheetsRouter(prisma));
app.use("/uploads", uploadLimiter, createUploadsRouter(prisma));
app.use("/matches", createMatchesRouter(prisma));
app.use("/pricing", createPricingRouter(prisma));
app.use("/billing", createBillingRouter(prisma));
app.use("/exports", createExportsRouter(prisma));

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
