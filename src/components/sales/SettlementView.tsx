import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { useCashlessSettlements } from "@/hooks/useSales";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { formatCurrency, exportToCSV } from "@/lib/csvExport";
import { Download, CreditCard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function SettlementView() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [groupBy, setGroupBy] = useState<"daily" | "weekly">("daily");

  const { data: settlements, isLoading } = useCashlessSettlements({ dateRange, groupBy });

  const handleExport = () => {
    if (!settlements) return;
    
    const exportData = settlements.flatMap((settlement: any) => 
      settlement.transactions.map((t: any) => ({
        Date: format(new Date(settlement.date), "yyyy-MM-dd"),
        Machine: t.machines?.asset_tag,
        Location: t.machines?.locations?.name,
        Product: t.products?.name,
        Quantity: t.qty,
        "Unit Price": t.unit_price,
        Subtotal: t.subtotal.toFixed(2),
        Tax: t.tax.toFixed(2),
        Total: t.total.toFixed(2),
      }))
    );

    exportToCSV(exportData, `cashless-settlements-${groupBy}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Cashless Settlements</CardTitle>
          </div>
          <div className="flex gap-2">
            <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
            <Button onClick={handleExport} size="sm" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements?.map((settlement: any) => {
                const subtotal = settlement.totalAmount - settlement.totalTax;
                
                return (
                  <TableRow key={settlement.date}>
                    <TableCell className="font-medium">
                      {groupBy === "weekly" 
                        ? `Week of ${format(new Date(settlement.date), "MMM dd, yyyy")}`
                        : format(new Date(settlement.date), "MMM dd, yyyy")
                      }
                    </TableCell>
                    <TableCell className="text-right">{settlement.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(subtotal)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(settlement.totalTax)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(settlement.totalAmount)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
