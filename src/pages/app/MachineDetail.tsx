import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, MapPin, Activity, DollarSign, Banknote, Package } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  useMachine,
  useMachineYesterdaySales,
  useMachineCashBoxEstimate,
  useMachineLastService,
  useMachineTelemetry,
  useMachineSales,
  useMachineTickets,
} from "@/hooks/useMachines";
import { PlanogramEditor } from "@/components/machines/PlanogramEditor";
import { useState } from "react";
import { subDays } from "date-fns";

export default function MachineDetail() {
  const { id } = useParams<{ id: string }>();
  const [salesStartDate, setSalesStartDate] = useState(subDays(new Date(), 30));
  const [salesEndDate, setSalesEndDate] = useState(new Date());

  const { data: machine, isLoading } = useMachine(id!);
  const { data: yesterdaySales } = useMachineYesterdaySales(id!);
  const { data: cashBox } = useMachineCashBoxEstimate(id!);
  const { data: lastService } = useMachineLastService(id!);
  const { data: telemetry } = useMachineTelemetry(id!);
  const { data: sales } = useMachineSales(id!, salesStartDate, salesEndDate);
  const { data: tickets } = useMachineTickets(id!);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!machine) {
    return <div className="p-6">Machine not found</div>;
  }

  const hasStockoutRisk = machine.slots?.some(
    (slot) => slot.current_qty < slot.par_level
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/app/machines">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{machine.asset_tag}</h1>
            <Badge variant={machine.status === "active" ? "default" : "secondary"}>
              {machine.status}
            </Badge>
            {hasStockoutRisk && (
              <Badge variant="destructive">Stockout Risk</Badge>
            )}
          </div>
          <p className="text-muted-foreground">{machine.model}</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {machine.location?.name || "Not assigned"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {machine.location?.address}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Service</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {lastService
                ? formatDistanceToNow(lastService, { addSuffix: true })
                : "Never"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Yesterday's Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              ${yesterdaySales?.toFixed(2) || "0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cash Box Estimate</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              ${cashBox?.toFixed(2) || "0.00"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="planogram">Planogram</TabsTrigger>
          <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Machine Information</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Asset Tag</p>
                <p className="font-medium">{machine.asset_tag}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Model</p>
                <p className="font-medium">{machine.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Serial Number</p>
                <p className="font-medium">{machine.serial}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cashless Enabled</p>
                <p className="font-medium">
                  {machine.cashless_enabled ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telemetry Device ID</p>
                <p className="font-medium">
                  {machine.telemetry_device_id || "Not configured"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Slots</p>
                <p className="font-medium">{machine.slots?.length || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stock Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {machine.slots
                  ?.filter((slot) => slot.product)
                  .map((slot) => {
                    const fillPercentage = (slot.current_qty / slot.capacity) * 100;
                    const isLow = slot.current_qty < slot.par_level;
                    return (
                      <div key={slot.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>
                            {slot.position} - {slot.product?.name}
                          </span>
                          <span>
                            {slot.current_qty}/{slot.capacity}
                            {isLow && (
                              <Badge variant="destructive" className="ml-2">
                                Low
                              </Badge>
                            )}
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              isLow ? "bg-destructive" : "bg-success"
                            }`}
                            style={{ width: `${fillPercentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planogram">
          {machine.slots && (
            <PlanogramEditor machineId={machine.id} slots={machine.slots} />
          )}
        </TabsContent>

        <TabsContent value="telemetry">
          <Card>
            <CardHeader>
              <CardTitle>Recent Telemetry Events</CardTitle>
            </CardHeader>
            <CardContent>
              {telemetry && telemetry.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {telemetry.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          {format(new Date(event.occurred_at), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.event_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {JSON.stringify(event.payload_json)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No telemetry data available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>Sales History</CardTitle>
            </CardHeader>
            <CardContent>
              {sales && sales.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {format(new Date(sale.occurred_at), "MMM dd, HH:mm")}
                        </TableCell>
                        <TableCell>{sale.product?.name}</TableCell>
                        <TableCell>{sale.qty}</TableCell>
                        <TableCell>${sale.unit_price}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{sale.payment_method}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          ${(sale.qty * sale.unit_price).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No sales data available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>Support Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {tickets && tickets.length > 0 ? (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <Card key={ticket.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">
                            {ticket.subject}
                          </CardTitle>
                          <div className="flex gap-2">
                            <Badge variant="outline">{ticket.status}</Badge>
                            <Badge
                              variant={
                                ticket.priority === "urgent"
                                  ? "destructive"
                                  : "default"
                              }
                            >
                              {ticket.priority}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {ticket.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Created {format(new Date(ticket.created_at), "MMM dd, yyyy")}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No tickets found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Machine Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Machine settings configuration coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
