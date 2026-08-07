import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyOrganization, useUpdateMyOrganization } from "@/hooks/useApi";

export default function Configuration() {
  const { data: org, isLoading } = useMyOrganization();
  const updateOrg = useUpdateMyOrganization();
  const [name, setName] = useState("");

  useEffect(() => {
    if (org) setName(org.name);
  }, [org]);

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-3xl font-bold">Configuration</h1>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button
              onClick={() => updateOrg.mutate({ name })}
              disabled={!name || name === org?.name || updateOrg.isPending}
            >
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        More configuration options (tax rates, default commission, notification preferences) will
        land here as those features are built out.
      </p>
    </div>
  );
}
