"use client";

import { useRef, useState } from "react";
import VideoUploader from "@/components/VideoUploader";
import AnalysisResults from "@/components/AnalysisResults";
import type {
  AnalysisStage,
  UXIssue,
  ValidatedIssue,
} from "@/types/analysis";

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [message, setMessage] = useState("");
  const [researcherFindings, setResearcherFindings] = useState<UXIssue[]>([]);
  const [validatedIssues, setValidatedIssues] = useState<ValidatedIssue[]>([]);
  const [overallAssessment, setOverallAssessment] = useState("");
  const [progress, setProgress] = useState({ validated: 0, total: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);

  const seekTo = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    video.play();
  };

  const resetAnalysisState = () => {
    setResearcherFindings([]);
    setValidatedIssues([]);
    setOverallAssessment("");
    setProgress({ validated: 0, total: 0 });
  };

  const handleFileSelect = (file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setStage("idle");
    resetAnalysisState();
  };

  const handleReset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl("");
    setStage("idle");
    setMessage("");
    resetAnalysisState();
  };

  const handleAnalyze = async () => {
    if (!videoFile) return;

    setStage("uploading");
    setMessage("Receiving video file...");
    resetAnalysisState();

    const formData = new FormData();
    formData.append("video", videoFile);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.body) throw new Error("No response body.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.stage) setStage(event.stage as AnalysisStage);
            if (event.message) setMessage(event.message);

            if (event.event === "researcher_complete" && event.researcherFindings) {
              setResearcherFindings(event.researcherFindings as UXIssue[]);
            }

            if (event.event === "issue_validated" && event.validatedIssue) {
              setValidatedIssues((prev) => [
                ...prev,
                event.validatedIssue as ValidatedIssue,
              ]);
              if (event.progress) setProgress(event.progress);
            }

            if (event.stage === "complete" && event.overallAssessment) {
              setOverallAssessment(event.overallAssessment as string);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setStage("error");
      setMessage(err instanceof Error ? err.message : "Analysis failed.");
    }
  };

  const isAnalyzing = [
    "uploading",
    "processing",
    "researching",
    "validating",
    "synthesizing",
  ].includes(stage);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 shadow-sm shadow-violet-500/30 flex items-center justify-center text-xs font-bold text-white">
            UX
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              Video UX Analyzer
            </p>
            <p className="text-xs text-muted-foreground">
              AI-powered product demo review
            </p>
          </div>
          <span className="text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1">
            Gemini · LangGraph
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <VideoUploader
            onFileSelect={handleFileSelect}
            videoUrl={videoUrl}
            onAnalyze={handleAnalyze}
            onReset={handleReset}
            isAnalyzing={isAnalyzing}
            videoRef={videoRef}
          />
          <AnalysisResults
            stage={stage}
            message={message}
            researcherFindings={researcherFindings}
            validatedIssues={validatedIssues}
            overallAssessment={overallAssessment}
            progress={progress}
            onSeekTo={seekTo}
          />
        </div>
      </main>
    </div>
  );
}
