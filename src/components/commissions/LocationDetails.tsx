import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, DollarSign, Calendar } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/csvExport";

interface LocationDetailsProps {
  location: any;
}

export function LocationDetails({ location }: LocationDetailsProps) {
  const getCommissionDisplay = () => {
    if (location.commission_type === "percentage") {
      return formatPercent(location.commission_value);
    } else {
      return `${formatCurrency(location.commission_value)} flat`;
    }
  };

  const getPayoutSchedule = () => {
    const schedules = {
      weekly: "Weekly",
      biweekly: "Bi-weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
    };
    return schedules[location.payout_frequency as keyof typeof schedules] || location.payout_frequency;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h3 className="font-semibold">{location.name}</h3>
              <p className="text-sm text-muted-foreground">{location.address}</p>
            </div>
          </div>

          {location.contact_name && (
            <div className="text-sm">
              <span className="text-muted-foreground">Contact: </span>
              <span className="font-medium">{location.contact_name}</span>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">Contract Terms</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Commission Rate</span>
              </div>
              <Badge variant="secondary" className="text-base">
                {getCommissionDisplay()}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Payout Schedule</span>
              </div>
              <Badge variant="outline">
                {getPayoutSchedule()}
              </Badge>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Commission Calculation</h4>
          <p className="text-sm text-muted-foreground">
            {location.commission_type === "percentage" 
              ? `Commission is calculated as ${formatPercent(location.commission_value)} of gross sales (including tax).`
              : `Fixed commission of ${formatCurrency(location.commission_value)} per period.`
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
