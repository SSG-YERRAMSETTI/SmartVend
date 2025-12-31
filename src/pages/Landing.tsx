import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Route,
  Package,
  DollarSign,
  BarChart3,
  Shield,
} from "lucide-react";
import heroImage from "@/assets/hero-vending.jpg";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Integrations } from "@/components/landing/Integrations";
import { Pricing } from "@/components/landing/Pricing";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { DemoVideo } from "@/components/landing/DemoVideo";
import { FAQ } from "@/components/landing/FAQ";
import { ContactTrial } from "@/components/landing/ContactTrial";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 flex items-center justify-center">
              <img
                src="/favicon.ico"
                alt="SmartVend logo"
                className="h-8 w-8"
              />

            </div>
            <span className="font-bold text-xl">SmartVend</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-sm font-medium hover:text-primary transition-colors">
              FAQ
            </a>
            <a href="#contact" className="text-sm font-medium hover:text-primary transition-colors">
              Contact
            </a>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/login")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/signup")}>Start Free Trial</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-10"></div>
        <div className="container mx-auto px-6 py-24 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold mb-6 leading-tight">
                Vending Operations,
                <span className="text-primary"> Simplified</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Manage your entire vending machine business from one powerful platform.
                Reduce stockouts, optimize routes, and maximize profitability.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={() => navigate("/signup")} className="h-14 px-8 text-base">
                  Start  →
                </Button>
                {/* <Button size="lg" variant="outline" className="h-14 px-8 text-base" onClick={() => {
                  document.getElementById('demo-video')?.scrollIntoView({ behavior: 'smooth' });
                }}>
                  Watch Demo
                </Button> */}
              </div>
              <div className="flex items-center gap-8 mt-8 text-sm text-muted-foreground">
                {/* <div>✓ No credit card required</div>
                <div>✓ 14-day free trial</div>
                <div>✓ Cancel anytime</div> */}
              </div>
            </div>
            <div className="relative">
              <img
                src={heroImage}
                alt="SmartVend Dashboard"
                className="rounded-xl shadow-2xl border"
              />
            </div>
          </div>
        </div>
      </section>
{/* 
      {/* How It Works Section */}
      <HowItWorks />

      {/* Demo Video Section */}
      {/* <div id="demo-video">
        <DemoVideo />
      </div> */} 

      {/* Features Section */}
      <section className="py-24 bg-background" id="features">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed specifically for vending machine operators
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Smart Inventory</h3>
                <p className="text-muted-foreground">
                  Real-time inventory tracking with automated low-stock alerts and
                  predictive restocking recommendations.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                  <Route className="h-6 w-6 text-success" />
                </div>
                <h3 className="text-xl font-bold mb-2">Route Optimization</h3>
                <p className="text-muted-foreground">
                  AI-powered route planning that saves time and fuel costs while
                  ensuring machines stay fully stocked.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2">Payment Tracking</h3>
                <p className="text-muted-foreground">
                  Track cash and cashless payments, automate commission calculations,
                  and streamline financial reconciliation.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-warning" />
                </div>
                <h3 className="text-xl font-bold mb-2">Live Telemetry</h3>
                <p className="text-muted-foreground">
                  Monitor machine health, sales velocity, and performance metrics in
                  real-time from anywhere.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-xl font-bold mb-2">Advanced Analytics</h3>
                <p className="text-muted-foreground">
                  Comprehensive reporting on profitability, product performance, and
                  location analysis.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Role-Based Access</h3>
                <p className="text-muted-foreground">
                  Secure access controls for owners, dispatchers, drivers, and location
                  partners.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <Integrations />

      {/* Comparison Table Section */}
      {/* <ComparisonTable /> */}

      {/* Pricing Section */}
      {/* <Pricing /> */}

      {/* FAQ Section */}
      <FAQ />

      {/* Contact & Trial Section */}
      <ContactTrial />

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-20 w-20 flex items-center justify-center">
            <img src="/favicon.ico" alt="Logo" className="h-20 w-20" />
          </div>
                <span className="font-bold text-lg">SmartVend</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Modern vending machine management for forward-thinking operators.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-muted-foreground hover:text-primary transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="#faq" className="text-muted-foreground hover:text-primary transition-colors">FAQ</a></li>
                <li><a href="/signup" className="text-muted-foreground hover:text-primary transition-colors">Sign Up</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">About Us</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Careers</a></li>
                <li><a href="#contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Security</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              © 2025 SmartVend. All rights reserved.
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Twitter</a>
              <a href="#" className="hover:text-primary transition-colors">LinkedIn</a>
              <a href="#" className="hover:text-primary transition-colors">Facebook</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
