import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Download } from "lucide-react";
import { LocationDetails } from "@/components/commissions/LocationDetails";
import { CommissionStatementsTable } from "@/components/commissions/CommissionStatementsTable";
import { GenerateStatementDialog } from "@/components/commissions/GenerateStatementDialog";
import { useLocations, useCommissionStatements } from "@/hooks/useLocations";
import { exportToCSV, formatCurrency } from "@/lib/csvExport";

export default function Locations() {
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const { data: locations } = useLocations();
  const { data: statements } = useCommissionStatements(selectedLocationId || undefined);

  const selectedLocation = locations?.find((l: any) => l.id === selectedLocationId);

  const exportLocations = () => {
    if (locations) {
      const formatted = locations.map((l: any) => ({
        name: l.name,
        address: l.address,
        contact: l.contact_name,
        commission_type: l.commission_type,
        commission_value: l.commission_value,
        payout_frequency: l.payout_frequency,
      }));
      exportToCSV(formatted, "locations");
    }
  };

  const exportStatements = () => {
    if (statements) {
      const formatted = statements.map((s: any) => ({
        location: s.location?.name,
        period_start: s.period_start,
        period_end: s.period_end,
        gross_sales: s.gross_sales,
        commission_amount: s.commission_amount,
        adjustments: s.adjustments,
        status: s.status,
      }));
      exportToCSV(formatted, "commission-statements");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Locations & Commissions</h1>
          <p className="text-muted-foreground">Manage locations and commission statements</p>
        </div>
        <Button variant="outline" onClick={exportLocations}>
          <Download className="h-4 w-4 mr-2" />
          Export Locations
        </Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Statements</TabsTrigger>
          <TabsTrigger value="location">By Location</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Commission Statements</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportStatements}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <GenerateStatementDialog />
            </div>
          </div>
          
          {statements ? (
            <CommissionStatementsTable statements={statements} showLocation={true} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No commission statements yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="location" className="space-y-4">
          <div className="flex justify-between items-center">
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location: any) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <GenerateStatementDialog />
          </div>

          {selectedLocation ? (
            <div className="space-y-6">
              <LocationDetails location={selectedLocation} />
              
              {statements && statements.length > 0 ? (
                <CommissionStatementsTable statements={statements} showLocation={false} />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No statements for this location</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Select a location to view details</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
