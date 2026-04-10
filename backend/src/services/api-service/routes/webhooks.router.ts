import { Router, Request, Response } from "express";
import express from "express";
import { PrismaClient } from "@prisma/client";

export function createWebhooksRouter(prisma: PrismaClient) {
  const router = Router();

  // Stripe requires the raw body for signature verification
  router.post(
    "/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"] as string;

      if (!signature) {
        res.status(400).json({ error: { message: "Missing stripe-signature header" } });
        return;
      }

      try {
        const { StripeService } = await import("../../../lib/stripe");
        const stripeService = new StripeService(prisma);
        await stripeService.handleWebhook(req.body, signature);
        res.json({ received: true });
      } catch (err) {
        console.error("Webhook error:", err);
        res.status(400).json({ error: { message: "Webhook processing failed" } });
      }
    }
  );

  return router;
}
