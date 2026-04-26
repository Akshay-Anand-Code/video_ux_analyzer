"use client";

import { useState } from "react";
import {
  Compass,
  MousePointer2,
  Workflow,
  Accessibility,
  Clock,
  MessageSquare,
  Sparkles,
  Plus,
  ListChecks,
  Bug,
  Palette,
  type LucideIcon,
} from "lucide-react";
import type {
  AnalysisStage,
  UXIssue,
  ValidatedIssue,
} from "@/types/analysis";
import JiraTicketModal from "./JiraTicketModal";

interface Props {
  stage: AnalysisStage;
  message: string;
  researcherFindings: UXIssue[];
  validatedIssues: ValidatedIssue[];
  overallAssessment: string;
  progress: { validated: number; total: number };
  onSeekTo: (seconds: number) => void;
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3)
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return parseFloat(ts) || 0;
}

const STEPS = [
  {
    key: "upload",
    label: "Upload & Process",
    activeStages: ["uploading", "processing"] as AnalysisStage[],
  },
  {
    key: "research",
    label: "UX Research",
    activeStages: ["researching"] as AnalysisStage[],
  },
  {
    key: "validate",
    label: "Critic Validation",
    activeStages: ["validating"] as AnalysisStage[],
  },
  {
    key: "synth",
    label: "Synthesis",
    activeStages: ["synthesizing"] as AnalysisStage[],
  },
];

const STAGE_ORDER: AnalysisStage[] = [
  "idle",
  "uploading",
  "processing",
  "researching",
  "validating",
  "synthesizing",
  "complete",
];

function getStepStatus(
  step: (typeof STEPS)[0],
  currentStage: AnalysisStage
): "pending" | "active" | "done" {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const stepFirstIndex = Math.min(
    ...step.activeStages.map((s) => STAGE_ORDER.indexOf(s))
  );
  const stepLastIndex = Math.max(
    ...step.activeStages.map((s) => STAGE_ORDER.indexOf(s))
  );
  if (currentIndex > stepLastIndex) return "done";
  if (currentIndex >= stepFirstIndex) return "active";
  return "pending";
}

interface CategoryMeta {
  icon: LucideIcon;
  label: string;
  iconChip: string;
  iconColor: string;
  pill: string;
}

const CATEGORY_META: Record<UXIssue["category"], CategoryMeta> = {
  navigation: {
    icon: Compass,
    label: "Navigation",
    iconChip: "bg-purple-100",
    iconColor: "text-purple-600",
    pill: "bg-purple-50 text-purple-700 border-purple-200",
  },
  ui_element: {
    icon: MousePointer2,
    label: "UI Element",
    iconChip: "bg-blue-100",
    iconColor: "text-blue-600",
    pill: "bg-blue-50 text-blue-700 border-blue-200",
  },
  user_flow: {
    icon: Workflow,
    label: "User Flow",
    iconChip: "bg-emerald-100",
    iconColor: "text-emerald-600",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  accessibility: {
    icon: Accessibility,
    label: "Accessibility",
    iconChip: "bg-pink-100",
    iconColor: "text-pink-600",
    pill: "bg-pink-50 text-pink-700 border-pink-200",
  },
  interaction_delay: {
    icon: Clock,
    label: "Interaction Delay",
    iconChip: "bg-orange-100",
    iconColor: "text-orange-600",
    pill: "bg-orange-50 text-orange-700 border-orange-200",
  },
  unclear_messaging: {
    icon: MessageSquare,
    label: "Unclear Messaging",
    iconChip: "bg-teal-100",
    iconColor: "text-teal-600",
    pill: "bg-teal-50 text-teal-700 border-teal-200",
  },
};

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    cls: "bg-red-50 text-red-700 border border-red-200",
  },
  major: {
    label: "Major",
    cls: "bg-orange-50 text-orange-700 border border-orange-200",
  },
  minor: {
    label: "Minor",
    cls: "bg-amber-50 text-amber-700 border border-amber-200",
  },
};

const VERDICT_CONFIG = {
  genuine_bug: {
    label: "Genuine Bug",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border border-red-200",
  },
  stylistic_choice: {
    label: "Stylistic Choice",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  needs_investigation: {
    label: "Needs Investigation",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
  },
};

function CategoryIcon({ category }: { category: UXIssue["category"] }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <div
      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${meta.iconChip}`}
    >
      <Icon className={`w-5 h-5 ${meta.iconColor}`} strokeWidth={2} />
    </div>
  );
}

function CategoryPill({ category }: { category: UXIssue["category"] }) {
  const meta = CATEGORY_META[category];
  return (
    <span
      className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${meta.pill}`}
    >
      {meta.label}
    </span>
  );
}

function SeverityPill({ severity }: { severity: UXIssue["severity"] }) {
  const s = SEVERITY_CONFIG[severity];
  return (
    <span
      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

function TimestampButton({
  timestamp,
  onSeekTo,
}: {
  timestamp: string;
  onSeekTo: (s: number) => void;
}) {
  return (
    <button
      onClick={() => onSeekTo(parseTimestamp(timestamp))}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors group"
      title={`Jump to ${timestamp}`}
    >
      <Clock className="w-3 h-3" strokeWidth={2.5} />
      {timestamp}
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary/70">
        · jump to
      </span>
    </button>
  );
}

function ValidatedCard({
  issue,
  onSeekTo,
  onCreateTicket,
}: {
  issue: ValidatedIssue;
  onSeekTo: (s: number) => void;
  onCreateTicket: (issue: ValidatedIssue) => void;
}) {
  const verdict = VERDICT_CONFIG[issue.verdict];
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow animate-in fade-in-0 duration-300">
      <div className="flex items-center gap-3 mb-4">
        <CategoryIcon category={issue.category} />
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          <CategoryPill category={issue.category} />
          <SeverityPill severity={issue.severity} />
        </div>
        <span
          className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${verdict.badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${verdict.dot}`} />
          {verdict.label}
        </span>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-foreground leading-relaxed">
          {issue.description}
        </p>

        {issue.timestamp && (
          <TimestampButton timestamp={issue.timestamp} onSeekTo={onSeekTo} />
        )}

        <div className="text-xs leading-relaxed border-l-2 border-border pl-3 py-0.5">
          <span className="font-medium text-muted-foreground">Critic: </span>
          <span className="text-foreground/80">{issue.criticReasoning}</span>
        </div>
      </div>

      <div className="flex justify-end pt-3 mt-3 border-t border-border/70">
        <button
          onClick={() => onCreateTicket(issue)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          Create Jira Ticket
        </button>
      </div>
    </div>
  );
}

function SkeletonCard({
  issue,
  onSeekTo,
}: {
  issue: UXIssue;
  onSeekTo: (s: number) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-black/[0.03] to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <CategoryIcon category={issue.category} />
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            <CategoryPill category={issue.category} />
            <SeverityPill severity={issue.severity} />
          </div>
          <span className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 bg-muted text-muted-foreground border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse" />
            Validating...
          </span>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-foreground leading-relaxed">
            {issue.description}
          </p>

          {issue.timestamp && (
            <TimestampButton timestamp={issue.timestamp} onSeekTo={onSeekTo} />
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  icon: Icon,
  tone,
}: {
  value: number;
  label: string;
  icon: LucideIcon;
  tone: "slate" | "red" | "blue";
}) {
  const tones = {
    slate: {
      chip: "bg-slate-100",
      icon: "text-slate-600",
      value: "text-foreground",
    },
    red: { chip: "bg-red-100", icon: "text-red-600", value: "text-red-700" },
    blue: {
      chip: "bg-blue-100",
      icon: "text-blue-600",
      value: "text-blue-700",
    },
  }[tone];

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div
        className={`w-9 h-9 rounded-xl ${tones.chip} flex items-center justify-center mb-3`}
      >
        <Icon className={`w-4 h-4 ${tones.icon}`} strokeWidth={2.5} />
      </div>
      <p className={`text-3xl font-bold tabular-nums ${tones.value}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function sortBySeverity<T extends UXIssue>(issues: T[]): T[] {
  const order = { critical: 0, major: 1, minor: 2 };
  return [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
}

export default function AnalysisResults({
  stage,
  message,
  researcherFindings,
  validatedIssues,
  overallAssessment,
  progress,
  onSeekTo,
}: Props) {
  const [ticketIssue, setTicketIssue] = useState<ValidatedIssue | null>(null);
  const hasFindings = researcherFindings.length > 0;
  const validatedMap = new Map(validatedIssues.map((v) => [v.id, v]));

  if (stage === "idle") {
    return (
      <div className="h-full flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="w-16 h-16 rounded-3xl bg-card border border-border shadow-sm flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-muted-foreground/60" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No analysis yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload a video and click Analyze UX
          </p>
        </div>
      </div>
    );
  }

  const hasPartialResults =
    researcherFindings.length > 0 || validatedIssues.length > 0;

  if (stage === "error" && !hasPartialResults) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analysis Results</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Something went wrong during analysis.
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-red-700">Analysis failed</p>
          <p className="text-xs text-red-600 mt-1">{message}</p>
        </div>
      </div>
    );
  }

  const showStepper =
    stage === "uploading" ||
    stage === "processing" ||
    stage === "researching" ||
    stage === "validating" ||
    stage === "synthesizing";

  const totalValidated = validatedIssues.length;
  const genuineBugs = validatedIssues.filter(
    (i) => i.verdict === "genuine_bug"
  ).length;
  const stylistic = validatedIssues.filter(
    (i) => i.verdict === "stylistic_choice"
  ).length;

  const sortedFindings = sortBySeverity(researcherFindings);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Analysis Results</h2>
        <p className="text-sm text-muted-foreground mt-1">
          AI-validated UX findings from your product demo.
        </p>
      </div>

      {stage === "error" && hasPartialResults && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-red-700">
            Analysis interrupted
          </p>
          <p className="text-xs text-red-600 mt-1">{message}</p>
          <p className="text-xs text-red-600/80 mt-2">
            Partial results below are still valid.
          </p>
        </div>
      )}

      {showStepper && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-3">
            {STEPS.map((step) => {
              const status = getStepStatus(step, stage);
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all
                      ${
                        status === "done"
                          ? "bg-primary"
                          : status === "active"
                          ? "bg-primary/15 ring-2 ring-primary"
                          : "bg-muted"
                      }
                    `}
                  >
                    {status === "done" ? (
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : status === "active" ? (
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  <span
                    className={`text-sm transition-colors
                      ${
                        status === "active"
                          ? "text-foreground font-medium"
                          : status === "done"
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60"
                      }
                    `}
                  >
                    {step.label}
                    {status === "active" &&
                      step.key === "validate" &&
                      progress.total > 0 && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {progress.validated}/{progress.total}
                        </span>
                      )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            {message}
          </p>
        </div>
      )}

      {(stage === "complete" || hasFindings) && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              value={researcherFindings.length}
              label="Total Issues"
              icon={ListChecks}
              tone="slate"
            />
            <StatCard
              value={genuineBugs}
              label="Genuine Bugs"
              icon={Bug}
              tone="red"
            />
            <StatCard
              value={stylistic}
              label="Stylistic"
              icon={Palette}
              tone="blue"
            />
          </div>

          {overallAssessment && (
            <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-violet-50/70 p-5 shadow-sm animate-in fade-in-0 duration-500">
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-violet-200/30 blur-2xl pointer-events-none" />
              <div className="relative flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0 shadow-sm shadow-violet-200">
                  <Sparkles className="w-5 h-5 text-violet-600" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-1.5">
                    Overall Assessment
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {overallAssessment}
                  </p>
                </div>
              </div>
            </div>
          )}

          {stage === "validating" &&
            totalValidated < researcherFindings.length && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Critic validating {totalValidated} of{" "}
                {researcherFindings.length}...
              </div>
            )}

          <div className="space-y-3">
            {sortedFindings.map((finding) => {
              const validated = validatedMap.get(finding.id);
              return validated ? (
                <ValidatedCard
                  key={finding.id}
                  issue={validated}
                  onSeekTo={onSeekTo}
                  onCreateTicket={setTicketIssue}
                />
              ) : (
                <SkeletonCard
                  key={finding.id}
                  issue={finding}
                  onSeekTo={onSeekTo}
                />
              );
            })}
          </div>
        </div>
      )}

      <JiraTicketModal
        issue={ticketIssue}
        onClose={() => setTicketIssue(null)}
      />
    </div>
  );
}
