import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoCaptureProps {
  onPhotoCapture: (file: File) => void;
  onClose: () => void;
}

export function PhotoCapture({ onPhotoCapture, onClose }: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      onPhotoCapture(file);
    }
  };

  return (
    <Card className="fixed inset-4 z-50 max-w-lg mx-auto my-auto h-fit">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle>Add Photo</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {preview ? (
          <div className="space-y-4">
            <img 
              src={preview} 
              alt="Preview" 
              className="w-full rounded-lg max-h-[400px] object-cover"
            />
            <Button 
              variant="secondary" 
              onClick={() => {
                setPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (cameraInputRef.current) cameraInputRef.current.value = '';
              }}
              className="w-full h-12"
            >
              Take Another Photo
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full h-16 text-lg"
              size="lg"
            >
              <Camera className="h-6 w-6 mr-2" />
              Take Photo
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
              className="w-full h-16 text-lg"
              size="lg"
            >
              <Upload className="h-6 w-6 mr-2" />
              Upload from Gallery
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
