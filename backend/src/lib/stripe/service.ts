import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-24.acacia",
});

const PLAN_CONFIGS = {
  starter: { matchLimit: 500, pricePerMatchCents: 10 },
  professional: { matchLimit: 5000, pricePerMatchCents: 8 },
  enterprise: { matchLimit: 25000, pricePerMatchCents: 5 },
} as const;

export class StripeService {
  constructor(private prisma: PrismaClient) {}

  async getOrCreateCustomer(orgId: string): Promise<string> {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (org.stripeCustomerId) return org.stripeCustomerId;

    const customer = await stripe.customers.create({
      metadata: { orgId },
    });

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createCheckoutSession(
    orgId: string,
    planTier: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    const customerId = await this.getOrCreateCustomer(orgId);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: `price_${planTier}`, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { orgId, planTier },
    });
    return session.url!;
  }

  async createBillingPortalSession(orgId: string, returnUrl: string): Promise<string> {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (!org.stripeCustomerId) throw new Error("No Stripe customer");
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        const planTier = session.metadata?.planTier;
        if (!orgId || !planTier) break;

        const config = PLAN_CONFIGS[planTier as keyof typeof PLAN_CONFIGS];
        if (!config) break;

        await this.prisma.$transaction(async (tx) => {
          await tx.organization.update({
            where: { id: orgId },
            data: {
              planTier,
              monthlyMatchLimit: config.matchLimit,
              matchesUsedThisPeriod: 0,
              billingPeriodStart: new Date(),
            },
          });
          await tx.subscription.create({
            data: {
              orgId,
              stripeSubscriptionId: session.subscription as string,
              planTier,
              status: "active",
              matchLimit: config.matchLimit,
              pricePerMatchCents: config.pricePerMatchCents,
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status:
              sub.status === "active"
                ? "active"
                : sub.status === "past_due"
                  ? "past_due"
                  : "canceled",
          },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "canceled" },
        });
        // Downgrade org to starter
        const subscription = await this.prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (subscription) {
          await this.prisma.organization.update({
            where: { id: subscription.orgId },
            data: { planTier: "starter", monthlyMatchLimit: 500 },
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        console.warn("Payment failed:", event.data.object);
        break;
      }
    }
  }

  async trackMatchUsage(
    orgId: string,
    matchCount: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const newCount = org.matchesUsedThisPeriod + matchCount;

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { matchesUsedThisPeriod: newCount },
    });

    return {
      allowed: true,
      remaining: Math.max(0, org.monthlyMatchLimit - newCount),
    };
  }
}
