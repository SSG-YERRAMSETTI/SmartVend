import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Activity, DollarSign, Banknote, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { useMachineYesterdaySales, useMachineCashBoxEstimate, useMachineLastService } from "@/hooks/useMachines";

interface MachineCardProps {
  machine: {
    id: string;
    asset_tag: string;
    model: string;
    status: string;
    location?: {
      name: string;
      address: string;
    };
    slots?: Array<{
      current_qty: number;
      par_level: number;
    }>;
  };
}

export function MachineCard({ machine }: MachineCardProps) {
  const { data: yesterdaySales } = useMachineYesterdaySales(machine.id);
  const { data: cashBox } = useMachineCashBoxEstimate(machine.id);
  const { data: lastService } = useMachineLastService(machine.id);

  const hasStockoutRisk = machine.slots?.some(
    (slot) => slot.current_qty < slot.par_level
  );

  const stockoutCount = machine.slots?.filter(
    (slot) => slot.current_qty < slot.par_level
  ).length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{machine.asset_tag}</CardTitle>
          <div className="flex gap-2">
            {hasStockoutRisk && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {stockoutCount} Low
              </Badge>
            )}
            <Badge variant={machine.status === "active" ? "default" : "secondary"}>
              {machine.status}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{machine.model}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {machine.location && (
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">{machine.location.name}</span>
          </div>
        )}
        
        <div className="flex items-center text-sm text-muted-foreground">
          <Activity className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>
            {lastService
              ? `Serviced ${formatDistanceToNow(lastService, { addSuffix: true })}`
              : "Never serviced"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <div className="flex items-center text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3 mr-1" />
              Yesterday
            </div>
            <p className="font-semibold">
              ${yesterdaySales?.toFixed(2) || "0.00"}
            </p>
          </div>
          <div>
            <div className="flex items-center text-xs text-muted-foreground mb-1">
              <Banknote className="h-3 w-3 mr-1" />
              Cash Box
            </div>
            <p className="font-semibold">
              ${cashBox?.toFixed(2) || "0.00"}
            </p>
          </div>
        </div>

        <Link to={`/app/machines/${machine.id}`} className="block pt-2">
          <Button size="sm" variant="outline" className="w-full">
            View Details
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
