import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, Map, TrendingUp, CheckCircle2 } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      icon: Smartphone,
      title: "1. Connect Your Machines",
      description: "Add your vending machines and locations in minutes. Import via CSV or add manually with our intuitive interface.",
    },
    {
      icon: Map,
      title: "2. Optimize Your Routes",
      description: "Our AI-powered system generates efficient routes based on sales data, machine health, and geographic proximity.",
    },
    {
      icon: TrendingUp,
      title: "3. Track in Real-Time",
      description: "Monitor inventory levels, sales, and machine status from anywhere. Get instant alerts for issues and opportunities.",
    },
    {
      icon: CheckCircle2,
      title: "4. Grow Your Business",
      description: "Make data-driven decisions with comprehensive analytics. Identify top performers and optimize your product mix.",
    },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get up and running in minutes with our simple, powerful platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <Card key={index} className="relative group hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
