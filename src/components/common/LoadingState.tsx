import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" aria-hidden="true" />
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {message}
        </p>
      </CardContent>
    </Card>
  );
}
