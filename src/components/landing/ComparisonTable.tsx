import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";

export function ComparisonTable() {
  const features = [
    { name: "Manual spreadsheets", manual: true, smartvend: false },
    { name: "Real-time inventory", manual: false, smartvend: true },
    { name: "Route optimization", manual: false, smartvend: true },
    { name: "Mobile-friendly", manual: false, smartvend: true },
    { name: "Commission automation", manual: false, smartvend: true },
    { name: "Live telemetry", manual: false, smartvend: true },
    { name: "Predictive analytics", manual: false, smartvend: true },
    { name: "Multi-user access", manual: false, smartvend: true },
    { name: "API integrations", manual: false, smartvend: true },
    { name: "Automated alerts", manual: false, smartvend: true },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Why Choose SmartVend?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            See how we stack up against traditional methods
          </p>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div></div>
              <CardTitle className="text-muted-foreground">
                Traditional Methods
              </CardTitle>
              <CardTitle className="text-primary">
                SmartVend
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div 
                  key={index} 
                  className="grid grid-cols-3 gap-4 items-center py-3 border-b last:border-0"
                >
                  <div className="font-medium">{feature.name}</div>
                  <div className="flex justify-center">
                    {feature.manual ? (
                      <Check className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <img className="h-5 w-5 opacity-50" src="/favicon.ico" alt="No" />
                    )}
                  </div>
                  <div className="flex justify-center">
                    {feature.smartvend ? (
                      <Check className="h-5 w-5 text-primary" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
