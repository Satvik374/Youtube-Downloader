import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { X, Loader2 } from "lucide-react";

interface ProgressTrackerProps {
  onCancel: () => void;
}

export default function ProgressTracker({ onCancel }: ProgressTrackerProps) {
  const [progress, setProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState("0 KB/s");
  const [fileSize] = useState("45.2 MB");
  const [timeLeft, setTimeLeft] = useState("--:--");
  const [status, setStatus] = useState("Processing");

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + Math.random() * 15;
        if (newProgress >= 100) {
          setStatus("Completed");
          clearInterval(interval);
          return 100;
        }
        
        // Update mock data
        setDownloadSpeed(Math.round(Math.random() * 1000 + 500) + " KB/s");
        const timeRemaining = Math.round((100 - newProgress) / 10);
        setTimeLeft(timeRemaining > 0 ? timeRemaining + "s" : "0s");
        
        return newProgress;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="mt-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="font-medium text-blue-800">Downloading...</span>
            <span className="text-blue-600">{Math.round(progress)}%</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="text-red-600 hover:text-red-800"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>

        <Progress value={progress} className="mb-4" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Speed:</span>
            <span className="font-medium ml-1">{downloadSpeed}</span>
          </div>
          <div>
            <span className="text-gray-500">Size:</span>
            <span className="font-medium ml-1">{fileSize}</span>
          </div>
          <div>
            <span className="text-gray-500">Time left:</span>
            <span className="font-medium ml-1">{timeLeft}</span>
          </div>
          <div>
            <span className="text-gray-500">Status:</span>
            <span className={`font-medium ml-1 ${status === "Completed" ? "text-green-600" : "text-blue-600"}`}>
              {status}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
