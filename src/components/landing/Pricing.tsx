import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Pricing() {
  const navigate = useNavigate();

  const plans = [
    {
      name: "Starter",
      price: "49",
      machines: "Up to 10 machines",
      popular: false,
      features: [
        "Real-time inventory tracking",
        "Basic route planning",
        "Sales reporting",
        "Mobile app access",
        "Email support",
        "CSV import/export",
      ],
    },
    {
      name: "Professional",
      price: "149",
      machines: "Up to 50 machines",
      popular: true,
      features: [
        "Everything in Starter",
        "Advanced route optimization",
        "Commission tracking",
        "Live telemetry integration",
        "Custom reporting",
        "Priority support",
        "API access",
        "Multi-user accounts",
      ],
    },
    {
      name: "Enterprise",
      price: "Custom",
      machines: "Unlimited machines",
      popular: false,
      features: [
        "Everything in Professional",
        "Dedicated account manager",
        "Custom integrations",
        "White-label options",
        "Advanced analytics",
        "SLA guarantee",
        "Training & onboarding",
        "24/7 phone support",
      ],
    },
  ];

  return (
    <section className="py-24 bg-background" id="pricing">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your operation. All plans include a 14-day free trial.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative ${plan.popular ? 'border-primary shadow-xl scale-105' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-8 pt-8">
                <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                <div className="mb-2">
                  <span className="text-4xl font-bold">
                    {plan.price === "Custom" ? "" : "$"}
                    {plan.price}
                  </span>
                  {plan.price !== "Custom" && (
                    <span className="text-muted-foreground">/month</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{plan.machines}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full h-12 text-base"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => navigate("/signup")}
                >
                  {plan.price === "Custom" ? "Contact Sales" : "Start Free Trial"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-12">
          All plans include unlimited users. Need more machines? Contact us for volume pricing.
        </p>
      </div>
    </section>
  );
}
