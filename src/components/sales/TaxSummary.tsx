import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { useTaxSummary } from "@/hooks/useSales";
import { DateRange } from "react-day-picker";
import { formatCurrency, formatPercent } from "@/lib/csvExport";
import { Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function TaxSummary() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { data: summary, isLoading } = useTaxSummary({ dateRange });

  const effectiveTaxRate = summary?.totalSales 
    ? (summary.totalTax / summary.totalSales) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Tax Summary</CardTitle>
          </div>
          <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Total Sales (Pre-tax)</span>
              <span className="text-xl font-bold">{formatCurrency(summary?.totalSales || 0)}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Total Tax Collected</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(summary?.totalTax || 0)}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Total with Tax</span>
              <span className="text-xl font-bold">{formatCurrency(summary?.totalWithTax || 0)}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div>
                <div className="text-sm text-muted-foreground">Effective Tax Rate</div>
                <div className="text-xs text-muted-foreground">
                  {summary?.transactionCount || 0} transactions
                </div>
              </div>
              <span className="text-xl font-bold text-primary">{formatPercent(effectiveTaxRate)}</span>
            </div>

            <div className="mt-4 p-4 bg-card border rounded-lg text-sm text-muted-foreground">
              <p className="font-medium mb-2">Tax Calculation Method:</p>
              <p>Each sale line item is taxed individually using the product's tax_rate. The tax is calculated as: <span className="font-mono bg-muted px-1 rounded">tax = (unit_price × qty) × (tax_rate / 100)</span></p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
