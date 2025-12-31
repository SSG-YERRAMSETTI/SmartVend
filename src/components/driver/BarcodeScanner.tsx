import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, X } from 'lucide-react';
import { toast } from 'sonner';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = 'barcode-scanner-region';

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(elementId);
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanning();
          toast.success('Barcode scanned');
        },
        (errorMessage) => {
          // Silent error - scanning continuously
        }
      );

      setScanning(true);
    } catch (error) {
      console.error('Error starting scanner:', error);
      toast.error('Failed to start camera');
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
      setScanning(false);
    }
  };

  return (
    <Card className="fixed inset-4 z-50 max-w-lg mx-auto my-auto h-fit">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle>Scan Barcode</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            stopScanning();
            onClose();
          }}
        >
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div id={elementId} className="rounded-lg overflow-hidden bg-muted min-h-[300px]" />
        
        {!scanning ? (
          <Button onClick={startScanning} className="w-full h-14 text-lg">
            <Camera className="h-6 w-6 mr-2" />
            Start Camera
          </Button>
        ) : (
          <Button onClick={stopScanning} variant="secondary" className="w-full h-14 text-lg">
            Stop Scanning
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
