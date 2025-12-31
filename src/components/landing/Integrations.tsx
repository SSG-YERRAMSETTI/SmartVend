import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Smartphone, CreditCard, BarChart3, Webhook, Database } from "lucide-react";

export function Integrations() {
  const integrations = [
    {
      icon: CreditCard,
      name: "Payment Processors",
      description: "Stripe, Square, PayPal",
      badge: "Popular",
    },
    {
      icon: Smartphone,
      name: "Telemetry Systems",
      description: "Cantaloupe, Nayax, USA Technologies",
      badge: "Real-time",
    },
    {
      icon: BarChart3,
      name: "Analytics Tools",
      description: "Google Analytics, Mixpanel",
      badge: "Insights",
    },
    {
      icon: Webhook,
      name: "API Access",
      description: "RESTful API with webhooks",
      badge: "Developer",
    },
    {
      icon: Database,
      name: "Data Export",
      description: "CSV, JSON, Excel formats",
      badge: "Flexible",
    },
    {
      icon: Zap,
      name: "Automation",
      description: "Zapier, Make, custom triggers",
      badge: "Workflow",
    },
  ];

  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Seamless Integrations</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect with your existing tools and hardware for a unified ecosystem
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {integrations.map((integration, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all hover:border-primary/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <integration.icon className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {integration.badge}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold mb-2">{integration.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {integration.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Need a custom integration? <span className="text-primary font-medium">Contact our team</span>
          </p>
        </div>
      </div>
    </section>
  );
}
