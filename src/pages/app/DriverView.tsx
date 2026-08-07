import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, MapPin } from "lucide-react";
import { useTrips } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

export default function DriverView() {
  const { user } = useAuth();
  const { data: trips, isLoading } = useTrips();

  const active = trips?.filter((t) => t.status !== "completed") ?? [];
  const past = trips?.filter((t) => t.status === "completed") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">
          Hi{user?.full_name ? `, ${user.full_name}` : ""}
        </h1>
        <p className="text-muted-foreground">Your restocking trips</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading your trips...</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Trips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {active.length === 0 ? (
                <div className="py-8 text-center">
                  <Truck className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No trips assigned right now.</p>
                </div>
              ) : (
                active.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{t.trip_date}</p>
                        <Badge variant="secondary" className="mt-1">
                          {t.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <Button asChild>
                      <Link to={`/app/trips/${t.id}`}>Enter Trip Results</Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {past.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Completed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {past.slice(0, 10).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <p className="text-sm">{t.trip_date}</p>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/app/trips/${t.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
