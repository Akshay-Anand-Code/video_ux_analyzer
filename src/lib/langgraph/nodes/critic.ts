import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AppState } from "../state";
import type { UXIssue, ValidatedIssue } from "@/types/analysis";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_INSTRUCTION = `You are a VP of Design at a Series B SaaS company with deep expertise in both UX \
research and product strategy. You've reviewed hundreds of UX research reports and you know that not every rough \
edge is a bug — some are intentional design decisions, brand choices, or platform conventions.

Your role is to critically validate a single UX finding at a time, distinguishing genuine usability bugs from \
stylistic choices or ambiguous cases. You are balanced, thoughtful, and consider business context alongside user needs.`;

function buildPrompt(issueJson: string): string {
  return `A UX Researcher flagged this single issue in a product demo video:

${issueJson}

Classify this one issue. Return ONLY a valid JSON object — no markdown, no extra text:

{
  "verdict": "<one of: genuine_bug | stylistic_choice | needs_investigation>",
  "criticReasoning": "<1-2 sentence reasoning for your verdict>"
}

Verdict guide:
- genuine_bug: Real usability problem with clear negative user impact.
- stylistic_choice: Likely an intentional design or brand decision.
- needs_investigation: Cannot determine without user research data, analytics, or more context.`;
}

function extractJSON<T>(text: string): T {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) return JSON.parse(objectMatch[0]) as T;
  return JSON.parse(cleaned) as T;
}

export interface CriticInput {
  issue: UXIssue;
}

export async function criticNode(input: CriticInput): Promise<Partial<AppState>> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const result = await model.generateContent(
      buildPrompt(JSON.stringify(input.issue, null, 2))
    );

    const { verdict, criticReasoning } = extractJSON<{
      verdict: ValidatedIssue["verdict"];
      criticReasoning: string;
    }>(result.response.text());

    const validatedIssue: ValidatedIssue = {
      ...input.issue,
      verdict,
      criticReasoning,
    };

    return { validatedIssues: [validatedIssue] };
  } catch (err) {
    const fallback: ValidatedIssue = {
      ...input.issue,
      verdict: "needs_investigation",
      criticReasoning: `Critic validation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
    return { validatedIssues: [fallback] };
  }
}
