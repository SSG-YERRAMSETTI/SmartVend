import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesTimeline } from "@/components/sales/SalesTimeline";
import { CashCollectionWorkflow } from "@/components/sales/CashCollectionWorkflow";
import { SettlementView } from "@/components/sales/SettlementView";
import { TaxSummary } from "@/components/sales/TaxSummary";
import { SalesChart } from "@/components/telemetry/SalesChart";

export default function Sales() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Sales & Payments</h1>
        <p className="text-muted-foreground">Track sales, cash collections, and settlements</p>
      </div>

      <SalesChart />

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Sales Timeline</TabsTrigger>
          <TabsTrigger value="cash">Cash Collections</TabsTrigger>
          <TabsTrigger value="settlements">Cashless Settlements</TabsTrigger>
          <TabsTrigger value="tax">Tax Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <SalesTimeline />
        </TabsContent>

        <TabsContent value="cash" className="space-y-4">
          <CashCollectionWorkflow />
        </TabsContent>

        <TabsContent value="settlements" className="space-y-4">
          <SettlementView />
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <TaxSummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
