export interface UXIssue {
  id: string;
  category:
    | "navigation"
    | "ui_element"
    | "user_flow"
    | "accessibility"
    | "interaction_delay"
    | "unclear_messaging";
  description: string;
  timestamp?: string;
  severity: "critical" | "major" | "minor";
}

export interface ValidatedIssue extends UXIssue {
  verdict: "genuine_bug" | "stylistic_choice" | "needs_investigation";
  criticReasoning: string;
}

export interface AnalysisResult {
  validatedIssues: ValidatedIssue[];
  overallAssessment: string;
  researcherFindings: UXIssue[];
}

export type AnalysisStage =
  | "idle"
  | "uploading"
  | "processing"
  | "researching"
  | "validating"
  | "synthesizing"
  | "complete"
  | "error";
