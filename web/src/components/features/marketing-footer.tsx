export function MarketingFooter() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Pinpoint AI. All rights reserved.
      </div>
    </footer>
  );
}
