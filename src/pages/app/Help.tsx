import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Video, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Help() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Help Center</h1>
        <p className="text-muted-foreground">Documentation and support resources</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Documentation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Complete guides and API references
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Browse Docs
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
              <Video className="h-6 w-6 text-accent" />
            </div>
            <CardTitle>Video Tutorials</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Step-by-step video walkthroughs
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Watch Videos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
              <HelpCircle className="h-6 w-6 text-success" />
            </div>
            <CardTitle>Support</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Get help from our support team
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
