import { Card, CardContent } from "@/components/ui/card";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DemoVideo() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">See SmartVend in Action</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Watch how easy it is to manage your entire vending operation
          </p>
        </div>

        <Card className="max-w-5xl mx-auto overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-video bg-gradient-hero">
              <div className="absolute inset-0 flex items-center justify-center">
                <Button 
                  size="lg" 
                  className="h-20 w-20 rounded-full"
                  variant="secondary"
                >
                  <Play className="h-8 w-8 ml-1" fill="currentColor" />
                </Button>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-primary-foreground/80 mt-32">
                  <p className="text-lg font-medium">Demo Video Coming Soon</p>
                  <p className="text-sm">Product walkthrough • 3:45</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <p className="text-muted-foreground">
            Want a personalized demo? <span className="text-primary font-medium cursor-pointer hover:underline">Schedule a call</span>
          </p>
        </div>
      </div>
    </section>
  );
}
