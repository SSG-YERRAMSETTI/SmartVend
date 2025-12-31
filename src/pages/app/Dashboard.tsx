import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Route,
  AlertCircle,
  Banknote,
  Calendar,
} from "lucide-react";
import { DashboardWidget } from "@/components/dashboard/DashboardWidget";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { ExpiringInventoryWidget } from "@/components/dashboard/ExpiringInventoryWidget";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import {
  useTodaysSales,
  useLast7DaysSales,
  useStockoutRisk,
  useTopProducts,
  useRouteEfficiency,
  useOpenTickets,
  useCashVariance,
  useCommissionsDue,
} from "@/hooks/useDashboardData";
import { exportToCSV, formatCurrency, formatNumber, formatPercent } from "@/lib/csvExport";
import { format } from "date-fns";

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });

  const { data: salesData, isLoading: salesLoading } = useTodaysSales(
    dateRange ? { start: dateRange.from!, end: dateRange.to! } : undefined
  );
  const { data: last7Days } = useLast7DaysSales();
  const { data: stockoutData, isLoading: stockoutLoading } = useStockoutRisk();
  const { data: productsData, isLoading: productsLoading } = useTopProducts(
    dateRange ? { start: dateRange.from!, end: dateRange.to! } : undefined
  );
  const { data: routeData, isLoading: routeLoading } = useRouteEfficiency(
    dateRange ? { start: dateRange.from!, end: dateRange.to! } : undefined
  );
  const { data: ticketsData, isLoading: ticketsLoading } = useOpenTickets();
  const { data: varianceData, isLoading: varianceLoading } = useCashVariance(
    dateRange ? { start: dateRange.from!, end: dateRange.to! } : undefined
  );
  const { data: commissionsData, isLoading: commissionsLoading } = useCommissionsDue();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your business overview.</p>
        </div>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Today's Sales */}
        <DashboardWidget
          title="Today's Sales"
          icon={<DollarSign className="h-5 w-5" />}
          linkTo="/app/sales"
          onExport={() =>
            salesData &&
            exportToCSV(
              [
                { type: "Cash", amount: salesData.cash },
                { type: "Cashless", amount: salesData.cashless },
                { type: "Total", amount: salesData.total },
              ],
              "todays_sales"
            )
          }
          isLoading={salesLoading}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cash</span>
                <span className="font-semibold">{formatCurrency(salesData?.cash || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cashless</span>
                <span className="font-semibold">{formatCurrency(salesData?.cashless || 0)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Total</span>
                <span className="text-xl font-bold">{formatCurrency(salesData?.total || 0)}</span>
              </div>
            </div>
            {last7Days && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Last 7 Days</p>
                <Sparkline data={last7Days} />
              </div>
            )}
          </div>
        </DashboardWidget>

        {/* Stockout Risk */}
        <DashboardWidget
          title="Stockout Risk"
          icon={<AlertTriangle className="h-5 w-5 text-warning" />}
          linkTo="/app/inventory"
          onExport={() =>
            stockoutData &&
            exportToCSV(
              stockoutData.map((slot: any) => ({
                machine: slot.machine?.asset_tag,
                location: slot.machine?.location?.name,
                position: slot.position,
                product: slot.product?.name,
                current: slot.current_qty,
                par_level: slot.par_level,
              })),
              "stockout_risk"
            )
          }
          isLoading={stockoutLoading}
        >
          <div className="space-y-3">
            <div className="text-3xl font-bold">{stockoutData?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Machines with slots below par</p>
            {stockoutData && stockoutData.length > 0 && (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {stockoutData.slice(0, 3).map((slot: any) => (
                  <div key={slot.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{slot.machine?.asset_tag}</span>
                    <Badge variant="outline" className="text-warning">
                      {slot.position}: {slot.current_qty}/{slot.par_level}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DashboardWidget>

        {/* Route Efficiency */}
        <DashboardWidget
          title="Route Efficiency"
          icon={<Route className="h-5 w-5" />}
          linkTo="/app/routes"
          onExport={() =>
            routeData &&
            exportToCSV(
              [
                {
                  planned: routeData.planned,
                  completed: routeData.completed,
                  efficiency: `${routeData.efficiency}%`,
                },
              ],
              "route_efficiency"
            )
          }
          isLoading={routeLoading}
        >
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-success">{routeData?.efficiency || 0}%</div>
              <p className="text-sm text-muted-foreground mt-1">Completion Rate</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-semibold">{routeData?.completed || 0}</div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold">{routeData?.planned || 0}</div>
                <p className="text-xs text-muted-foreground">Planned</p>
              </div>
            </div>
          </div>
        </DashboardWidget>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Expiring Inventory */}
        <ExpiringInventoryWidget />

        {/* Top Products */}
        <DashboardWidget
          title="Top Products"
          icon={<TrendingUp className="h-5 w-5" />}
          linkTo="/app/inventory"
          onExport={() =>
            productsData &&
            exportToCSV(
              [...(productsData.byUnits || [])].map((p) => ({
                name: p.name,
                units: p.units,
                revenue: p.revenue,
                margin: p.margin,
              })),
              "top_products"
            )
          }
          isLoading={productsLoading}
        >
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-3">By Units Sold</h4>
              <div className="space-y-2">
                {productsData?.byUnits?.slice(0, 3).map((product: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{product.name}</span>
                    <span className="font-semibold">{formatNumber(product.units)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">By Margin</h4>
              <div className="space-y-2">
                {productsData?.byMargin?.slice(0, 3).map((product: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{product.name}</span>
                    <span className="font-semibold text-success">
                      {formatCurrency(product.margin)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DashboardWidget>

        {/* Open Tickets */}
        <DashboardWidget
          title="Open Tickets"
          icon={<AlertCircle className="h-5 w-5" />}
          linkTo="/app/help"
          onExport={() =>
            ticketsData &&
            exportToCSV(
              ticketsData.tickets.map((t: any) => ({
                priority: t.priority,
                status: t.status,
                subject: t.subject,
                machine: t.machine?.asset_tag,
              })),
              "open_tickets"
            )
          }
          isLoading={ticketsLoading}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center p-2 rounded-lg bg-destructive/10">
                <div className="text-xl font-bold text-destructive">
                  {ticketsData?.byPriority.urgent || 0}
                </div>
                <p className="text-xs text-muted-foreground">Urgent</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-warning/10">
                <div className="text-xl font-bold text-warning">
                  {ticketsData?.byPriority.high || 0}
                </div>
                <p className="text-xs text-muted-foreground">High</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-accent/10">
                <div className="text-xl font-bold">{ticketsData?.byPriority.medium || 0}</div>
                <p className="text-xs text-muted-foreground">Medium</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted">
                <div className="text-xl font-bold">{ticketsData?.byPriority.low || 0}</div>
                <p className="text-xs text-muted-foreground">Low</p>
              </div>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto pt-2 border-t">
              {ticketsData?.tickets.slice(0, 3).map((ticket: any) => (
                <div key={ticket.id} className="flex items-start justify-between gap-2">
                  <span className="text-sm flex-1 line-clamp-1">{ticket.subject}</span>
                  <Badge
                    variant={ticket.priority === "urgent" || ticket.priority === "high" ? "destructive" : "outline"}
                  >
                    {ticket.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </DashboardWidget>

        {/* Cash Variance */}
        <DashboardWidget
          title="Cash Variance"
          icon={<Banknote className="h-5 w-5" />}
          linkTo="/app/sales"
          onExport={() =>
            varianceData &&
            exportToCSV(
              varianceData.collections.map((c: any) => ({
                machine: c.machine?.asset_tag,
                expected: c.expected_cash,
                counted: c.counted_cash,
                variance: c.variance,
                date: format(new Date(c.collected_at), "yyyy-MM-dd"),
              })),
              "cash_variance"
            )
          }
          isLoading={varianceLoading}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatCurrency(varianceData?.totalVariance || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Total Variance</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatCurrency(varianceData?.avgVariance || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Avg. Variance</p>
              </div>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto pt-4 border-t">
              {varianceData?.collections.slice(0, 3).map((collection: any) => (
                <div key={collection.id} className="flex items-center justify-between text-sm">
                  <span>{collection.machine?.asset_tag}</span>
                  <span
                    className={`font-semibold ${
                      collection.variance >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(collection.variance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </DashboardWidget>

        {/* Commissions Due */}
        <DashboardWidget
          title="Commissions Due"
          icon={<Calendar className="h-5 w-5" />}
          linkTo="/app/locations"
          onExport={() =>
            commissionsData &&
            exportToCSV(
              commissionsData.statements.map((s: any) => ({
                location: s.location?.name,
                period_start: s.period_start,
                period_end: s.period_end,
                amount: s.commission_amount,
                status: s.status,
                payout_frequency: s.location?.payout_frequency,
              })),
              "commissions_due"
            )
          }
          isLoading={commissionsLoading}
        >
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {formatCurrency(commissionsData?.totalDue || 0)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Total Pending</p>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto pt-4 border-t">
              {commissionsData?.statements.slice(0, 3).map((statement: any) => (
                <div key={statement.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{statement.location?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {format(new Date(statement.period_end), "MMM dd")}
                    </p>
                  </div>
                  <span className="font-semibold">
                    {formatCurrency(statement.commission_amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </DashboardWidget>
      </div>
    </div>
  );
}
