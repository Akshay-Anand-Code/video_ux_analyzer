"use client";

import { useCallback, useRef, useState } from "react";
import { Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onFileSelect: (file: File) => void;
  videoUrl: string;
  onAnalyze: () => void;
  onReset: () => void;
  isAnalyzing: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function VideoUploader({
  onFileSelect,
  videoUrl,
  onAnalyze,
  onReset,
  isAnalyzing,
  videoRef,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("video/")) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Video Input</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a 1–5 minute product demo video.
        </p>
      </div>

      {!videoUrl ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-200 shadow-sm
            ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 bg-card"
            }
          `}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Video className="w-7 h-7 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Drop your product demo video here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                MP4, MOV, WebM · 1–5 minutes recommended
              </p>
            </div>
            <span className="text-xs text-muted-foreground border border-border bg-muted/50 rounded-lg px-3 py-1">
              or click to browse
            </span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={handleChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="rounded-3xl overflow-hidden bg-card border border-border shadow-sm">
          <video ref={videoRef} src={videoUrl} controls className="w-full aspect-video" />
        </div>
      )}

      {videoUrl && (
        <div className="flex gap-3">
          <Button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            size="lg"
            className="flex-1 h-11 rounded-xl shadow-sm shadow-primary/20"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze UX"
            )}
          </Button>
          {!isAnalyzing && (
            <Button
              onClick={onReset}
              variant="outline"
              size="lg"
              className="h-11 rounded-xl"
            >
              Change
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
