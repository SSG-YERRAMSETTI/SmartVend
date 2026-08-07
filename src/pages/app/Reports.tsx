import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertCircle, TrendingUp, Calculator } from "lucide-react";
import {
  useTrips, useTickets, useMileageLogs, useExpenses, useProfitSummary, useProfitByMachine, useMachines,
  useMarginByProduct, useProfitByRange,
} from "@/hooks/useApi";

export default function Reports() {
  const { data: trips } = useTrips();
  const { data: tickets } = useTickets();
  const { data: mileage } = useMileageLogs();
  const { data: expenses } = useExpenses();
  const { data: profitSummary } = useProfitSummary();
  const { data: profitByMachine } = useProfitByMachine();
  const { data: machines } = useMachines();
  const { data: margins } = useMarginByProduct();

  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [rangeFrom, setRangeFrom] = useState(monthAgo);
  const [rangeTo, setRangeTo] = useState(today);
  const { data: range, isFetching: rangeLoading } = useProfitByRange(rangeFrom, rangeTo);

  const completedTrips = trips?.filter((t) => t.status === "completed").length ?? 0;
  const openTickets = tickets?.filter((t) => t.status !== "resolved" && t.status !== "closed").length ?? 0;
  const totalMiles = mileage?.reduce((s, m) => s + Number(m.miles), 0) ?? 0;
  const totalExpenses = expenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;

  const machineName = (id: string) => machines?.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Reports</h1>
        <p className="text-muted-foreground">Operational and financial overview</p>
      </div>

      {(!profitSummary || profitSummary.total_revenue === 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-900">
              Revenue/profit figures below are $0 because no vend transactions have been recorded yet —
              restocking updates inventory but doesn't simulate sales. Once telemetry or manual sale entry
              is built, this section will populate automatically.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Profit by Date Range
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Gross income minus every real expense in the window — inventory purchases included,
            since those land in Expenses automatically when confirmed.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" className="h-9" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" className="h-9" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
            </div>
          </div>

          {rangeLoading ? (
            <p className="text-sm text-muted-foreground">Calculating...</p>
          ) : range ? (
            <>
              <div className="grid grid-cols-3 gap-6 text-center pt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">${range.revenue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <p className="text-2xl font-bold">${range.total_expenses.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Profit</p>
                  <p className={`text-2xl font-bold ${range.profit >= 0 ? "text-primary" : "text-destructive"}`}>
                    ${range.profit.toFixed(2)}
                  </p>
                </div>
              </div>
              {range.expense_breakdown.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Expense breakdown</p>
                  <div className="space-y-1">
                    {range.expense_breakdown.map((b) => (
                      <div key={b.category} className="flex items-center justify-between text-sm">
                        <span>{b.category}</span>
                        <span>${b.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Trips Completed" value={completedTrips} />
        <StatCard label="Open Tickets" value={openTickets} />
        <StatCard label="Miles Logged" value={totalMiles.toFixed(1)} />
        <StatCard label="Total Expenses" value={`$${totalExpenses.toFixed(2)}`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Profit & Loss</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-2xl font-bold">${(profitSummary?.total_revenue ?? 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost of Goods</p>
              <p className="text-2xl font-bold">${(profitSummary?.total_cost ?? 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p className="text-2xl font-bold text-primary">${(profitSummary?.total_profit ?? 0).toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {margins && margins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Margin by Product
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Potential margin per unit — cost from your latest confirmed purchase, against
              every price this product is currently configured to sell for. This is not
              realized profit; it doesn't know how many units actually sold.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Sell Price</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Where</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {margins.slice(0, 25).flatMap((m) =>
                  m.price_points.map((pp, i) => (
                    <TableRow key={`${m.product_id}-${pp.price}`}>
                      <TableCell className={i === 0 ? "font-medium" : "text-muted-foreground"}>
                        {i === 0 ? m.product_name : ""}
                      </TableCell>
                      <TableCell className="text-right">{i === 0 ? `$${m.cost_price.toFixed(2)}` : ""}</TableCell>
                      <TableCell className="text-right">${pp.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={pp.margin_dollar >= 0 ? "text-green-600" : "text-destructive"}>
                          ${pp.margin_dollar.toFixed(2)} ({pp.margin_pct}%)
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[220px]">
                        {pp.locations[0]}{pp.locations.length > 1 ? ` +${pp.locations.length - 1} more` : ""}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {profitByMachine && profitByMachine.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Profit by Machine</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profitByMachine.map((m) => (
                  <TableRow key={m.machine_id}>
                    <TableCell>{m.machine_name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.location_name}</TableCell>
                    <TableCell className="text-right">${m.revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${m.cost.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${m.profit.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Trips</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips?.slice(0, 10).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.trip_date}</TableCell>
                  <TableCell><Badge variant={t.status === "completed" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                </TableRow>
              ))}
              {(!trips || trips.length === 0) && (
                <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No trips yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
