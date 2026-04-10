import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { errorPassthrough } from "../middleware/error-passthrough";
import { verifyToken } from "../middleware/auth";
import { AuthenticatedRequest } from "../../../shared/types";

export function createBillingRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(verifyToken);

  // POST /billing/checkout — create Stripe checkout session
  router.post(
    "/checkout",
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const { planTier, successUrl, cancelUrl } = req.body;

      if (!planTier || !successUrl || !cancelUrl) {
        res.status(400).json({ error: { message: "planTier, successUrl, and cancelUrl are required" } });
        return;
      }

      if (!["professional", "enterprise"].includes(planTier)) {
        res.status(400).json({ error: { message: "Invalid plan tier" } });
        return;
      }

      const { StripeService } = await import("../../../lib/stripe");
      const stripeService = new StripeService(prisma);
      const url = await stripeService.createCheckoutSession(
        req.orgId!,
        planTier,
        successUrl,
        cancelUrl
      );

      res.json({ data: { url } });
    })
  );

  // POST /billing/portal — create Stripe billing portal session
  router.post(
    "/portal",
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const { returnUrl } = req.body;

      if (!returnUrl) {
        res.status(400).json({ error: { message: "returnUrl is required" } });
        return;
      }

      const { StripeService } = await import("../../../lib/stripe");
      const stripeService = new StripeService(prisma);
      const url = await stripeService.createBillingPortalSession(req.orgId!, returnUrl);

      res.json({ data: { url } });
    })
  );

  // GET /billing/usage — current usage stats
  router.get(
    "/usage",
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: req.orgId! },
        select: {
          planTier: true,
          monthlyMatchLimit: true,
          matchesUsedThisPeriod: true,
          billingPeriodStart: true,
        },
      });

      const subscription = await prisma.subscription.findFirst({
        where: { orgId: req.orgId!, status: "active" },
        orderBy: { createdAt: "desc" },
        select: {
          planTier: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
        },
      });

      res.json({
        data: {
          planTier: org.planTier,
          monthlyMatchLimit: org.monthlyMatchLimit,
          matchesUsedThisPeriod: org.matchesUsedThisPeriod,
          billingPeriodStart: org.billingPeriodStart,
          subscription: subscription || null,
        },
      });
    })
  );

  return router;
}
