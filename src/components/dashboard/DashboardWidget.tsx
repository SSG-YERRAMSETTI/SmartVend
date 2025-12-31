import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { ReactNode } from "react";

interface DashboardWidgetProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  linkTo?: string;
  linkText?: string;
  onExport?: () => void;
  isLoading?: boolean;
}

export function DashboardWidget({
  title,
  icon,
  children,
  linkTo,
  linkText = "View Details",
  onExport,
  isLoading,
}: DashboardWidgetProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExport}
              disabled={isLoading}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {linkTo && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={linkTo} className="flex items-center gap-1">
                <span className="text-xs">{linkText}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
