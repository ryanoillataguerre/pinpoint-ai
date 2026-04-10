import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { MarketingHeader } from "@/components/features/marketing-header";
import { MarketingFooter } from "@/components/features/marketing-footer";

const tiers = [
  {
    name: "Starter",
    price: "Free",
    priceDetail: "No credit card required",
    matchLimit: "500 matches/mo",
    description: "Perfect for trying out Pinpoint AI with small inventories.",
    features: [
      "500 product matches per month",
      "CSV and Excel uploads",
      "AI-powered matching",
      "Basic pricing intelligence",
      "Email support",
    ],
    cta: "Get Started",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$99",
    priceDetail: "per month",
    matchLimit: "5,000 matches/mo",
    description:
      "For growing businesses that need high-volume matching and priority support.",
    features: [
      "5,000 product matches per month",
      "CSV, Excel, and image uploads",
      "AI-powered matching with LLM ranking",
      "Full pricing intelligence & analytics",
      "Priority email support",
      "Bulk approval tools",
      "CSV export with pricing data",
      "$0.08/match overage",
    ],
    cta: "Upgrade to Professional",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$299",
    priceDetail: "per month",
    matchLimit: "25,000 matches/mo",
    description:
      "For large operations requiring maximum throughput and dedicated support.",
    features: [
      "25,000 product matches per month",
      "All Professional features",
      "Dedicated account manager",
      "Custom integrations & API access",
      "Advanced analytics dashboard",
      "Phone & Slack support",
      "Custom match confidence tuning",
      "$0.05/match overage",
    ],
    cta: "Upgrade to Enterprise",
    href: "/signup",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 pb-20 pt-16 text-white">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-300">
            Start free with 500 matches per month. Upgrade as your business grows.
            No hidden fees, no long-term contracts.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto -mt-12 max-w-5xl px-6 pb-20">
        <div className="grid gap-8 md:grid-cols-3">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={
                tier.highlighted
                  ? "relative border-2 border-indigo-500 shadow-xl shadow-indigo-500/10"
                  : "border shadow-lg"
              }
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.priceDetail !== "No credit card required" && (
                      <span className="text-sm text-muted-foreground">
                        /{tier.priceDetail.replace("per ", "")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tier.matchLimit}
                  </p>
                </div>
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link href={tier.href} className="w-full">
                  <Button
                    className="w-full"
                    variant={tier.highlighted ? "default" : "outline"}
                    size="lg"
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ / Additional info */}
        <div className="mt-16 text-center">
          <h2 className="mb-6 text-2xl font-bold">Frequently asked questions</h2>
          <div className="mx-auto max-w-2xl space-y-6 text-left">
            <div>
              <h3 className="font-semibold">What counts as a match?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Each product line item that goes through our AI matching pipeline counts as
                one match, regardless of whether a match is found or not.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">What happens if I exceed my monthly limit?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your matches will continue to work. Overage charges apply at the rate for
                your plan tier and are billed at the end of your billing period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Can I cancel anytime?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Yes. There are no long-term contracts. You can cancel your subscription at
                any time from your billing settings, and you will retain access until the
                end of your current billing period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Do unused matches roll over?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No. Match allowances reset at the beginning of each billing period.
              </p>
            </div>
          </div>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
