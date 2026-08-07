import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { Download } from "lucide-react";
import { useSales } from "@/hooks/useSales";
import { useMachines } from "@/hooks/useMachines";
import { useProducts } from "@/hooks/useInventory";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { formatCurrency, exportToCSV } from "@/lib/csvExport";
import { Skeleton } from "@/components/ui/skeleton";

export function SalesTimeline() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [machineId, setMachineId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");

  const { data: sales, isLoading } = useSales({
    dateRange,
    machineId: machineId || undefined,
    productId: productId || undefined,
    paymentMethod: paymentMethod || undefined,
  });

  const { data: machines } = useMachines();
  const { data: products } = useProducts();

  const handleExport = () => {
    if (!sales) return;
    
    const exportData = sales.map((sale: any) => {
      const subtotal = sale.unit_price * sale.qty;
      const taxRate = sale.products?.tax_rate || 0;
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;

      return {
        Date: format(new Date(sale.occurred_at), "yyyy-MM-dd HH:mm"),
        Machine: sale.machines?.asset_tag,
        Location: sale.machines?.locations?.name,
        Product: sale.products?.name,
        SKU: sale.products?.sku,
        Quantity: sale.qty,
        "Unit Price": sale.unit_price,
        Subtotal: subtotal.toFixed(2),
        "Tax Rate": `${taxRate}%`,
        Tax: tax.toFixed(2),
        Total: total.toFixed(2),
        "Payment Method": sale.payment_method,
      };
    });

    exportToCSV(exportData, "sales-timeline");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Sales Timeline</CardTitle>
          <div className="flex gap-2">
            <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
            <Button onClick={handleExport} size="sm" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Select value={machineId} onValueChange={setMachineId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Machines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Machines</SelectItem>
              {machines?.map((machine: any) => (
                <SelectItem key={machine.id} value={machine.id}>
                  {machine.asset_tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Products</SelectItem>
              {products?.map((product: any) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Payment Methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Methods</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="cashless">Cashless</SelectItem>
            </SelectContent>
          </Select>
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
                <TableHead>Date & Time</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales?.map((sale: any) => {
                const subtotal = sale.unit_price * sale.qty;
                const taxRate = sale.products?.tax_rate || 0;
                const tax = subtotal * (taxRate / 100);
                const total = subtotal + tax;

                return (
                  <TableRow key={sale.id}>
                    <TableCell>{format(new Date(sale.occurred_at), "MMM dd, HH:mm")}</TableCell>
                    <TableCell>{sale.machines?.asset_tag}</TableCell>
                    <TableCell>{sale.machines?.locations?.name || "—"}</TableCell>
                    <TableCell>{sale.products?.name}</TableCell>
                    <TableCell className="text-right">{sale.qty}</TableCell>
                    <TableCell className="text-right">{formatCurrency(subtotal)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(tax)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                    <TableCell>
                      <span className={sale.payment_method === "cash" ? "text-success" : "text-primary"}>
                        {sale.payment_method}
                      </span>
                    </TableCell>
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
