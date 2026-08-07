import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Package, Box, MapPin, Truck, AlertTriangle, ArrowRight, Settings2,
  ArrowUp, ArrowDown, TrendingUp, Clock, Ticket as TicketIcon, Users, Receipt,
} from "lucide-react";
import {
  useProducts, useMachines, useLocations, useTrips, useTickets, useOrgUsers,
  useMarginByProduct, useExpiringSoon, useExpenses, useDashboardLayout, useUpdateDashboardLayout,
} from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { AssistantChatBar } from "@/components/dashboard/AssistantChatBar";

const WIDGET_LABELS: Record<string, string> = {
  stats: "Quick Stats",
  low_stock: "Low Stock",
  active_trips: "Active Trips",
  top_products: "Top Products by Margin",
  expiring_soon: "Expiring Soon",
  margin_snapshot: "Margin Snapshot",
  recent_tickets: "Recent Tickets",
  team: "Team",
  recent_trips: "Recent Trips",
  expenses_summary: "Expenses Summary",
};

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const canManage = hasRole("route_owner");
  const { data: layout } = useDashboardLayout();
  const updateLayout = useUpdateDashboardLayout();

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);

  useEffect(() => {
    if (layout) setDraft(layout.widgets);
  }, [layout]);

  const widgets = layout?.widgets ?? ["stats", "low_stock", "active_trips"];
  const available = layout?.available_widgets ?? Object.keys(WIDGET_LABELS);

  const toggleDraft = (id: string) =>
    setDraft((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));

  const move = (id: string, dir: -1 | 1) => {
    setDraft((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const saveLayout = () => updateLayout.mutate(draft, { onSuccess: () => setCustomizeOpen(false) });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
          </h1>
          <p className="text-muted-foreground">Here's what's happening with your operation.</p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Customize
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          {widgets.map((id) => (
            <WidgetRenderer key={id} id={id} />
          ))}
          {widgets.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No widgets selected — click Customize to add some.
              </CardContent>
            </Card>
          )}
        </div>
        <div className="lg:sticky lg:top-6 h-fit">
          <AssistantChatBar />
        </div>
      </div>

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Customize Dashboard</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {draft.map((id, i) => (
              <div key={id} className="flex items-center justify-between border rounded-md p-2">
                <label className="flex items-center gap-2 text-sm flex-1">
                  <Checkbox checked onCheckedChange={() => toggleDraft(id)} />
                  {WIDGET_LABELS[id] ?? id}
                </label>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(id, -1)} disabled={i === 0}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(id, 1)} disabled={i === draft.length - 1}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {available.filter((id) => !draft.includes(id)).map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm border rounded-md p-2 text-muted-foreground">
                <Checkbox checked={false} onCheckedChange={() => toggleDraft(id)} />
                {WIDGET_LABELS[id] ?? id}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomizeOpen(false)}>Cancel</Button>
            <Button onClick={saveLayout} disabled={updateLayout.isPending}>Save Layout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WidgetRenderer({ id }: { id: string }) {
  switch (id) {
    case "stats": return <StatsWidget />;
    case "low_stock": return <LowStockWidget />;
    case "active_trips": return <ActiveTripsWidget />;
    case "top_products": return <TopProductsWidget />;
    case "expiring_soon": return <ExpiringSoonWidget />;
    case "margin_snapshot": return <MarginSnapshotWidget />;
    case "recent_tickets": return <RecentTicketsWidget />;
    case "team": return <TeamWidget />;
    case "recent_trips": return <RecentTripsWidget />;
    case "expenses_summary": return <ExpensesSummaryWidget />;
    default: return null;
  }
}

function StatsWidget() {
  const { data: products } = useProducts();
  const { data: machines } = useMachines();
  const { data: locations } = useLocations();
  const { data: trips } = useTrips();
  const activeTrips = trips?.filter((t) => t.status !== "completed") ?? [];

  const stats = [
    { label: "Products", value: products?.length ?? "—", icon: Package, href: "/app/products" },
    { label: "Machines", value: machines?.length ?? "—", icon: Box, href: "/app/machines" },
    { label: "Locations", value: locations?.length ?? "—", icon: MapPin, href: "/app/locations" },
    { label: "Active Trips", value: activeTrips.length, icon: Truck, href: "/app/trips" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Link key={s.label} to={s.href}>
          <Card className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </div>
              <s.icon className="h-6 w-6 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function LowStockWidget() {
  const { data: products } = useProducts();
  const lowStock = products?.filter((p) => p.active && (p.warehouse_stock ?? 0) <= (p.reorder_point ?? 0)) ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Low Stock
        </CardTitle>
        {lowStock.length > 0 && <Badge variant="destructive">{lowStock.length}</Badge>}
      </CardHeader>
      <CardContent className="space-y-2">
        {lowStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing below reorder point.</p>
        ) : (
          <>
            {lowStock.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1">
                <span>{p.name}</span>
                <span className="text-muted-foreground">{p.warehouse_stock ?? 0} in stock</span>
              </div>
            ))}
            <Button variant="link" size="sm" asChild className="px-0">
              <Link to="/app/products">View all products <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveTripsWidget() {
  const { data: trips } = useTrips();
  const active = trips?.filter((t) => t.status !== "completed") ?? [];
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Truck className="h-5 w-5" /> Active Trips</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trips in progress.</p>
        ) : (
          <>
            {active.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1">
                <span>{t.trip_date}</span>
                <Badge variant="secondary">{t.status.replace("_", " ")}</Badge>
              </div>
            ))}
            <Button variant="link" size="sm" asChild className="px-0">
              <Link to="/app/trips">View all trips <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TopProductsWidget() {
  const { data: margins } = useMarginByProduct();
  const top = margins?.slice(0, 5) ?? [];
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Top Products by Margin</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {top.length === 0 ? <p className="text-sm text-muted-foreground">No margin data yet.</p> : top.map((m) => (
          <div key={m.product_id} className="flex items-center justify-between text-sm py-1">
            <span>{m.product_name}</span>
            <span className="text-green-600">{m.price_points[0]?.margin_pct}%</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExpiringSoonWidget() {
  const { data: expiring } = useExpiringSoon(14);
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5" /> Expiring Soon</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {!expiring || expiring.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing expiring in the next 14 days.</p>
        ) : expiring.slice(0, 6).map((b) => (
          <div key={b.batch_id} className="flex items-center justify-between text-sm py-1">
            <span>{b.product_name}</span>
            <span className="text-amber-600">{b.days_until_expiry}d</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MarginSnapshotWidget() {
  const { data: margins } = useMarginByProduct();
  const rows = margins?.slice(0, 5) ?? [];
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Margin Snapshot</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : rows.map((m) => (
          <div key={m.product_id} className="flex items-center justify-between text-sm py-1">
            <span>{m.product_name}</span>
            <span>${m.cost_price.toFixed(2)} → ${m.price_points[0]?.price.toFixed(2)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecentTicketsWidget() {
  const { data: tickets } = useTickets();
  const open = tickets?.filter((t) => t.status !== "resolved" && t.status !== "closed").slice(0, 5) ?? [];
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TicketIcon className="h-5 w-5" /> Recent Tickets</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {open.length === 0 ? <p className="text-sm text-muted-foreground">No open tickets.</p> : open.map((t) => (
          <div key={t.id} className="flex items-center justify-between text-sm py-1">
            <span>{t.subject}</span>
            <Badge variant="outline">{t.priority}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TeamWidget() {
  const { data: users } = useOrgUsers();
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Team</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {!users || users.length === 0 ? <p className="text-sm text-muted-foreground">No team members yet.</p> : users.slice(0, 6).map((u) => (
          <div key={u.id} className="flex items-center justify-between text-sm py-1">
            <span>{u.full_name || u.email}</span>
            <Badge variant="secondary">{u.role.replace("_", " ")}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecentTripsWidget() {
  const { data: trips } = useTrips();
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Recent Trips</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {trips?.slice(0, 5).map((t) => (
          <div key={t.id} className="flex items-center justify-between text-sm py-1">
            <span>{t.trip_date}</span>
            <Badge variant={t.status === "completed" ? "default" : "secondary"}>{t.status}</Badge>
          </div>
        ))}
        {(!trips || trips.length === 0) && <p className="text-sm text-muted-foreground">No trips yet.</p>}
      </CardContent>
    </Card>
  );
}

function ExpensesSummaryWidget() {
  const { data: expenses } = useExpenses();
  const total = expenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Receipt className="h-5 w-5" /> Expenses Summary</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">${total.toFixed(2)}</p>
        <p className="text-sm text-muted-foreground">{expenses?.length ?? 0} entries logged</p>
      </CardContent>
    </Card>
  );
}
