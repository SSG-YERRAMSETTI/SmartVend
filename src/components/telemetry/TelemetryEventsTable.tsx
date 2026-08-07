import { useTelemetryEvents } from "@/hooks/useTelemetry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export function TelemetryEventsTable() {
  const { data: events, isLoading } = useTelemetryEvents(50);

  const getEventTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      sale: "default",
      door_open: "secondary",
      door_close: "secondary",
      temperature: "outline",
      error: "destructive",
      maintenance: "outline",
    };
    return variants[type] || "outline";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Telemetry Events</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events?.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(event.occurred_at), "MMM d, HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getEventTypeBadge(event.event_type)}>
                      {event.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{event.machines?.asset_tag || "N/A"}</TableCell>
                  <TableCell>{event.machines?.locations?.name || "N/A"}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {event.payload_json ? JSON.stringify(event.payload_json) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
