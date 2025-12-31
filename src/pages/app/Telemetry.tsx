import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, Wifi } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelemetryEventsTable } from "@/components/telemetry/TelemetryEventsTable";
import { SalesChart } from "@/components/telemetry/SalesChart";
import { AlertRules } from "@/components/telemetry/AlertRules";
import { NotificationCenter } from "@/components/telemetry/NotificationCenter";
import { TelemetrySimulator } from "@/components/telemetry/TelemetrySimulator";

export default function Telemetry() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Telemetry</h1>
        <p className="text-muted-foreground">Real-time machine monitoring and analytics</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Connected Machines</CardTitle>
            <Wifi className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">139/142</div>
            <p className="text-xs text-muted-foreground mt-1">97.9% online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Uptime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.2%</div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sales Velocity</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24.5/day</div>
            <p className="text-xs text-muted-foreground mt-1">Per machine average</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="events" className="space-y-6">
            <TabsList>
              <TabsTrigger value="events">Live Events</TabsTrigger>
              <TabsTrigger value="charts">Analytics</TabsTrigger>
              <TabsTrigger value="rules">Alert Rules</TabsTrigger>
              <TabsTrigger value="simulator">Simulator</TabsTrigger>
            </TabsList>

            <TabsContent value="events">
              <TelemetryEventsTable />
            </TabsContent>

            <TabsContent value="charts">
              <SalesChart />
            </TabsContent>

            <TabsContent value="rules">
              <AlertRules />
            </TabsContent>

            <TabsContent value="simulator">
              <TelemetrySimulator />
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <NotificationCenter />
        </div>
      </div>
    </div>
  );
}
