import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2 } from 'lucide-react';

interface CompletionChecklistProps {
  onComplete: (data: {
    refillComplete: boolean;
    cleanComplete: boolean;
    cashCollected: boolean;
    notes: string;
  }) => void;
  initialNotes?: string;
}

export function CompletionChecklist({ onComplete, initialNotes = '' }: CompletionChecklistProps) {
  const [refillComplete, setRefillComplete] = useState(false);
  const [cleanComplete, setCleanComplete] = useState(false);
  const [cashCollected, setCashCollected] = useState(false);
  const [notes, setNotes] = useState(initialNotes);

  const allComplete = refillComplete && cleanComplete && cashCollected;

  const handleComplete = () => {
    onComplete({
      refillComplete,
      cleanComplete,
      cashCollected,
      notes,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Complete Stop Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
            <Checkbox 
              id="refill" 
              checked={refillComplete}
              onCheckedChange={(checked) => setRefillComplete(checked as boolean)}
              className="h-6 w-6"
            />
            <Label 
              htmlFor="refill" 
              className="text-base font-medium cursor-pointer flex-1"
            >
              Refill completed
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
            <Checkbox 
              id="clean" 
              checked={cleanComplete}
              onCheckedChange={(checked) => setCleanComplete(checked as boolean)}
              className="h-6 w-6"
            />
            <Label 
              htmlFor="clean" 
              className="text-base font-medium cursor-pointer flex-1"
            >
              Machine cleaned
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
            <Checkbox 
              id="cash" 
              checked={cashCollected}
              onCheckedChange={(checked) => setCashCollected(checked as boolean)}
              className="h-6 w-6"
            />
            <Label 
              htmlFor="cash" 
              className="text-base font-medium cursor-pointer flex-1"
            >
              Cash collected
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-base">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes about this stop..."
            rows={4}
            className="text-base"
          />
        </div>

        <Button 
          onClick={handleComplete}
          disabled={!allComplete}
          className="w-full h-14 text-lg"
          size="lg"
        >
          <CheckCircle2 className="h-6 w-6 mr-2" />
          Complete Stop
        </Button>
      </CardContent>
    </Card>
  );
}
