"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { MarketingHeader } from "@/components/features/marketing-header";
import { MarketingFooter } from "@/components/features/marketing-footer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, Zap, DollarSign, CheckCircle } from "lucide-react";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/sheets");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-gradient-to-b from-background to-muted/30 py-24">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Turn messy inventory into
              <span className="text-primary"> matched products</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Upload any line sheet &mdash; CSV, Excel, images, or PDFs. Our AI
              matches items to real products on Amazon, fetches live pricing, and
              gives you the intelligence to buy smarter.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Start Free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-11 items-center rounded-md border px-8 text-sm font-medium hover:bg-accent"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Everything you need to identify &amp; price inventory
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <Upload className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">Any Format</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Upload CSVs, Excel files, photos of catalogs, or PDF line
                  sheets. We extract every item automatically.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Zap className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">AI Matching</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Multi-source product search combined with LLM ranking delivers
                  high-confidence matches to real ASINs and UPCs.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <DollarSign className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">
                    Pricing Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Live Amazon buy-box prices, 30/90-day averages, BSR ranks, and
                  profit margin calculations at your fingertips.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CheckCircle className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">Bulk Operations</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Review matches in bulk, approve with one click, export full
                  pricing reports as CSV. Process thousands of items fast.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="mb-12 text-center text-3xl font-bold">
              How it works
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Upload",
                  desc: "Drop your line sheet in any format. We parse and extract every product row.",
                },
                {
                  step: "2",
                  title: "Match",
                  desc: "AI searches multiple databases and ranks the best product match for each item.",
                },
                {
                  step: "3",
                  title: "Price",
                  desc: "Get live Amazon pricing, margins, and ROI. Export your analysis to CSV.",
                },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                    {s.step}
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <h2 className="text-3xl font-bold">
              Ready to streamline your sourcing?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Start with 500 free matches per month. No credit card required.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex h-11 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Get Started Free
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
