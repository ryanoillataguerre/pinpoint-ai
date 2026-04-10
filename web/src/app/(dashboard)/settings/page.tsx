"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CreditCard, ArrowUpRight, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";

interface UsageData {
  planTier: string;
  monthlyMatchLimit: number;
  matchesUsedThisPeriod: number;
  billingPeriodStart: string | null;
  subscription: {
    planTier: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter (Free)",
  professional: "Professional ($99/mo)",
  enterprise: "Enterprise ($299/mo)",
};

const PLAN_PRICES: Record<string, string> = {
  starter: "Free",
  professional: "$99/mo",
  enterprise: "$299/mo",
};

export default function SettingsPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      const { data } = await api.get("/billing/usage");
      setUsage(data.data);
    } catch {
      toast.error("Failed to load billing information");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const handleManageBilling = async () => {
    setIsRedirecting(true);
    try {
      const { data } = await api.post("/billing/portal", {
        returnUrl: window.location.href,
      });
      window.location.href = data.data.url;
    } catch {
      toast.error("Failed to open billing portal");
      setIsRedirecting(false);
    }
  };

  const handleUpgrade = async (planTier: string) => {
    setIsRedirecting(true);
    try {
      const { data } = await api.post("/billing/checkout", {
        planTier,
        successUrl: `${window.location.origin}/settings?upgraded=true`,
        cancelUrl: window.location.href,
      });
      window.location.href = data.data.url;
    } catch {
      toast.error("Failed to start checkout");
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const usagePercent = usage
    ? Math.min(100, (usage.matchesUsedThisPeriod / usage.monthlyMatchLimit) * 100)
    : 0;

  const isOverLimit = usage
    ? usage.matchesUsedThisPeriod > usage.monthlyMatchLimit
    : false;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="grid gap-6">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <CardTitle>Current Plan</CardTitle>
            </div>
            <CardDescription>
              Manage your subscription and billing details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">
                  {PLAN_LABELS[usage?.planTier || "starter"] || usage?.planTier}
                </p>
                <p className="text-sm text-muted-foreground">
                  {PLAN_PRICES[usage?.planTier || "starter"]}
                </p>
              </div>
              {usage?.subscription && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  {usage.subscription.status}
                </span>
              )}
            </div>

            {usage?.subscription && (
              <p className="text-xs text-muted-foreground">
                Current period:{" "}
                {new Date(usage.subscription.currentPeriodStart).toLocaleDateString()} -{" "}
                {new Date(usage.subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}

            <div className="flex gap-3">
              {usage?.planTier !== "starter" && (
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={isRedirecting}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Billing
                </Button>
              )}
              {usage?.planTier === "starter" && (
                <>
                  <Button
                    onClick={() => handleUpgrade("professional")}
                    disabled={isRedirecting}
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Upgrade to Professional
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleUpgrade("enterprise")}
                    disabled={isRedirecting}
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Upgrade to Enterprise
                  </Button>
                </>
              )}
              {usage?.planTier === "professional" && (
                <Button
                  onClick={() => handleUpgrade("enterprise")}
                  disabled={isRedirecting}
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Upgrade to Enterprise
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <CardTitle>Usage This Period</CardTitle>
            </div>
            <CardDescription>
              Track your match usage against your plan limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold">
                  {usage?.matchesUsedThisPeriod.toLocaleString() || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  of {usage?.monthlyMatchLimit.toLocaleString() || 0} matches used
                </p>
              </div>
              <p className="text-sm font-medium">
                {Math.round(usagePercent)}%
              </p>
            </div>

            <Progress value={usagePercent} />

            {isOverLimit && (
              <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                You have exceeded your monthly match limit. Overage charges of $0.10 per
                match will apply.
              </div>
            )}

            {usage && usage.matchesUsedThisPeriod > usage.monthlyMatchLimit * 0.8 && !isOverLimit && (
              <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                You are approaching your monthly match limit. Consider upgrading your plan
                to avoid overage charges.
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">
                  {Math.max(0, (usage?.monthlyMatchLimit || 0) - (usage?.matchesUsedThisPeriod || 0)).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">
                  {usage?.monthlyMatchLimit.toLocaleString() || 0}
                </p>
                <p className="text-xs text-muted-foreground">Monthly Limit</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">
                  {isOverLimit
                    ? `$${(((usage?.matchesUsedThisPeriod || 0) - (usage?.monthlyMatchLimit || 0)) * 0.10).toFixed(2)}`
                    : "$0.00"}
                </p>
                <p className="text-xs text-muted-foreground">Overage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
