"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileSpreadsheet,
  LayoutDashboard,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/sheets", label: "Sheets", icon: FileSpreadsheet },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  const org = user?.organizationUsers?.[0]?.organization;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 border-r bg-card md:flex md:flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/sheets" className="text-lg font-semibold">
            Pinpoint AI
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          {org && (
            <p className="mb-2 truncate px-3 text-xs text-muted-foreground">
              {org.name} &middot; {org.planTier}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}
