import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 px-4">
        {Icon && (
          <div className="rounded-full bg-muted p-6 mb-4">
            <Icon className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            {description}
          </p>
        )}
        {action && (
          <Button onClick={action.onClick} aria-label={action.label}>
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
