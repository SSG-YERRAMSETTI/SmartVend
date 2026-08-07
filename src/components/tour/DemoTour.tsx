import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Package, 
  LayoutGrid, 
  ClipboardList, 
  Route, 
  DollarSign, 
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  route: string;
  actions?: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to VendTrack Pro",
    description: "Let's walk through the complete workflow from adding products to seeing results on your dashboard.",
    icon: CheckCircle2,
    route: "/app",
  },
  {
    id: "add-product",
    title: "Step 1: Add a Product",
    description: "Start by adding a product to your inventory. Go to Products & Inventory and click 'Add Product'.",
    icon: Package,
    route: "/app/inventory",
    actions: ["Navigate to Products & Inventory", "Click 'Add Product' button", "Fill in product details"],
  },
  {
    id: "assign-planogram",
    title: "Step 2: Assign to Planogram",
    description: "Assign your product to a machine slot. Go to a machine detail page and edit the planogram.",
    icon: LayoutGrid,
    route: "/app/machines",
    actions: ["Navigate to Machines", "Select a machine", "Click 'Planogram' tab", "Assign product to slot"],
  },
  {
    id: "create-route",
    title: "Step 3: Generate Pre-Kit",
    description: "Create a route with stops to generate a pre-kit list for your driver.",
    icon: Route,
    route: "/app/routes",
    actions: ["Navigate to Routes", "Create or select a route", "Add machines to route", "View pick list"],
  },
  {
    id: "complete-route",
    title: "Step 4: Complete Route Stop",
    description: "As a driver, complete the route stop by restocking machines and recording data.",
    icon: ClipboardList,
    route: "/app/driver",
    actions: ["Navigate to Driver View", "Select route stop", "Update slot quantities", "Mark as complete"],
  },
  {
    id: "record-collection",
    title: "Step 5: Record Cash Collection",
    description: "Record cash collected from the machine during the route stop.",
    icon: DollarSign,
    route: "/app/sales",
    actions: ["Navigate to Sales", "Record cash collection", "Upload photos (optional)", "Track variance"],
  },
  {
    id: "view-dashboard",
    title: "Step 6: See Dashboard Update",
    description: "View your updated dashboard with sales data, inventory levels, and performance metrics.",
    icon: BarChart3,
    route: "/app",
    actions: ["Navigate to Dashboard", "View updated metrics", "Check sales charts", "Review alerts"],
  },
];

export function DemoTour() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if tour has been seen
    const tourSeen = localStorage.getItem("demo-tour-completed");
    if (!tourSeen) {
      // Show tour after a short delay
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      navigate(TOUR_STEPS[nextStep].route);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      navigate(TOUR_STEPS[prevStep].route);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("demo-tour-completed", "skipped");
    setOpen(false);
  };

  const handleComplete = () => {
    localStorage.setItem("demo-tour-completed", "true");
    setOpen(false);
  };

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl" aria-describedby="tour-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {step.title}
          </DialogTitle>
        </DialogHeader>

        <div id="tour-description" className="space-y-6 py-4">
          <Progress value={progress} className="h-2" />
          
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <p className="text-muted-foreground">{step.description}</p>

                {step.actions && step.actions.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-medium text-sm">Actions to take:</div>
                    <ul className="space-y-2">
                      {step.actions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-2 pt-2">
            {TOUR_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-2 rounded-full transition-colors ${
                  idx === currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleSkip}>
            Skip Tour
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentStep < TOUR_STEPS.length - 1 ? (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                "Complete Tour"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
