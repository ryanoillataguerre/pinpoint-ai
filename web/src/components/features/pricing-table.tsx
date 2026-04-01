"use client";

interface PricingItem {
  id: string;
  rowNumber: number;
  rawDescription: string | null;
  rawPrice: string | null;
  normalizedDescription: string | null;
  normalizedBrand: string | null;
  matchConfidence: number | null;
  matchedProduct: {
    id: string;
    asin: string | null;
    upc: string | null;
    canonicalName: string | null;
    brand: string | null;
    imageUrl: string | null;
    pricingData: {
      buyBoxPriceCents: number | null;
      avg30DayPriceCents: number | null;
      avg90DayPriceCents: number | null;
      lowestPriceCents: number | null;
      soldLastMonth: number | null;
      totalOffers: number | null;
      bsrCategory: string | null;
      bsrRank: number | null;
      profitMargin: number | null;
      roi: number | null;
    } | null;
  } | null;
}

function cents(val: number | null | undefined): string {
  if (val == null) return "—";
  return `$${(val / 100).toFixed(2)}`;
}

function pct(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

export function PricingTable({ items }: { items: PricingItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-3 text-left font-medium">#</th>
            <th className="px-3 py-3 text-left font-medium">Product</th>
            <th className="px-3 py-3 text-left font-medium">ASIN</th>
            <th className="px-3 py-3 text-left font-medium">Wholesale</th>
            <th className="px-3 py-3 text-right font-medium">Buy Box</th>
            <th className="px-3 py-3 text-right font-medium">30d Avg</th>
            <th className="px-3 py-3 text-right font-medium">90d Avg</th>
            <th className="px-3 py-3 text-right font-medium">Lowest</th>
            <th className="px-3 py-3 text-right font-medium">Offers</th>
            <th className="px-3 py-3 text-right font-medium">BSR</th>
            <th className="px-3 py-3 text-right font-medium">Margin</th>
            <th className="px-3 py-3 text-right font-medium">ROI</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const mp = item.matchedProduct;
            const pd = mp?.pricingData;
            const margin = pd?.profitMargin;
            const marginColor =
              margin != null
                ? margin > 0.15
                  ? "text-green-600"
                  : margin > 0
                    ? "text-yellow-600"
                    : "text-red-600"
                : "";

            return (
              <tr key={item.id} className="border-b hover:bg-muted/30">
                <td className="px-3 py-3 text-muted-foreground">
                  {item.rowNumber}
                </td>
                <td className="max-w-[200px] px-3 py-3">
                  <div className="flex items-center gap-2">
                    {mp?.imageUrl && (
                      <img
                        src={mp.imageUrl}
                        alt=""
                        className="h-8 w-8 rounded border object-contain"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-xs">
                        {mp?.canonicalName || item.normalizedDescription || item.rawDescription || "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {mp?.brand || item.normalizedBrand || ""}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-xs">
                  {mp?.asin || "—"}
                </td>
                <td className="px-3 py-3 text-xs">
                  {item.rawPrice || "—"}
                </td>
                <td className="px-3 py-3 text-right font-medium">
                  {cents(pd?.buyBoxPriceCents)}
                </td>
                <td className="px-3 py-3 text-right">
                  {cents(pd?.avg30DayPriceCents)}
                </td>
                <td className="px-3 py-3 text-right">
                  {cents(pd?.avg90DayPriceCents)}
                </td>
                <td className="px-3 py-3 text-right">
                  {cents(pd?.lowestPriceCents)}
                </td>
                <td className="px-3 py-3 text-right">
                  {pd?.totalOffers ?? "—"}
                </td>
                <td className="px-3 py-3 text-right text-xs">
                  {pd?.bsrRank ? `#${pd.bsrRank.toLocaleString()}` : "—"}
                </td>
                <td className={`px-3 py-3 text-right font-medium ${marginColor}`}>
                  {pct(pd?.profitMargin)}
                </td>
                <td className={`px-3 py-3 text-right font-medium ${marginColor}`}>
                  {pct(pd?.roi)}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                No pricing data available yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
