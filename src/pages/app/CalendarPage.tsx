import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTrips } from "@/hooks/useApi";

export default function CalendarPage() {
  const { data: trips } = useTrips();
  const [cursor, setCursor] = useState(new Date());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const tripsByDate = new Map<string, typeof trips>();
  trips?.forEach((t) => {
    const key = t.trip_date;
    if (!tripsByDate.has(key)) tripsByDate.set(key, []);
    tripsByDate.get(key)!.push(t);
  });

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium w-40 text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className="min-h-24" />;
              const dateKey = `${year}-${pad(month + 1)}-${pad(day)}`;
              const dayTrips = tripsByDate.get(dateKey) ?? [];
              return (
                <div key={i} className="min-h-24 border rounded-md p-1.5">
                  <p className="text-xs text-muted-foreground mb-1">{day}</p>
                  <div className="space-y-1">
                    {dayTrips.slice(0, 3).map((t) => (
                      <Link key={t!.id} to={`/app/trips/${t!.id}`}>
                        <Badge
                          variant={t!.status === "completed" ? "default" : "secondary"}
                          className="block w-full truncate text-[10px] px-1 py-0.5"
                        >
                          Trip
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
