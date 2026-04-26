import { Annotation } from "@langchain/langgraph";
import type { UXIssue, ValidatedIssue } from "@/types/analysis";

export const StateAnnotation = Annotation.Root({
  videoUri: Annotation<string>(),
  videoMimeType: Annotation<string>(),
  researcherFindings: Annotation<UXIssue[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  validatedIssues: Annotation<ValidatedIssue[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  overallAssessment: Annotation<string>({
    reducer: (_, right) => right,
    default: () => "",
  }),
  error: Annotation<string | undefined>({
    reducer: (_, right) => right,
    default: () => undefined,
  }),
});

export type AppState = typeof StateAnnotation.State;
