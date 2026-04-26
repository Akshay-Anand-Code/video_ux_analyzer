import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AppState } from "../state";
import type { UXIssue } from "@/types/analysis";
import { callGeminiWithRetry } from "./gemini-utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_INSTRUCTION = `You are a Senior UX Researcher at Nielsen Norman Group with 15 years of experience \
analyzing enterprise and consumer SaaS products. You've evaluated hundreds of digital products and your analyses \
are evidence-based, specific, and focused on measurable user impact.

When watching a product demo, you mentally simulate being a first-time user — noting every moment of confusion, \
friction, unclear affordance, or missed accessibility consideration. You are thorough but fair: you only flag \
issues that genuinely affect the user experience.`;

const PROMPT = `Watch this product demo video carefully and identify all UX issues present.

For each issue found, produce a JSON object with these exact fields:
- id: unique string identifier (e.g., "issue_1", "issue_2")
- category: MUST be one of: "navigation" | "ui_element" | "user_flow" | "accessibility" | "interaction_delay" | "unclear_messaging"
- description: specific, actionable description of the problem and its impact on the user (2-3 sentences)
- timestamp: approximate time in the video where this occurs (e.g., "0:45", "1:30") — omit if not identifiable
- severity: MUST be one of: "critical" | "major" | "minor"

Severity guide:
- critical: directly blocks a user from completing a core task
- major: causes significant confusion, frustration, or requires workaround
- minor: noticeable annoyance but task can still be completed without much friction

Return ONLY a valid JSON array. No markdown, no explanation, no code fences. Example:
[{"id":"issue_1","category":"navigation","description":"...","timestamp":"0:45","severity":"major"}]`;

function extractJSON<T>(text: string): T {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) return JSON.parse(arrayMatch[0]) as T;
  return JSON.parse(cleaned) as T;
}

export async function researcherNode(
  state: AppState
): Promise<Partial<AppState>> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const result = await callGeminiWithRetry(() =>
      model.generateContent([
        { fileData: { mimeType: state.videoMimeType, fileUri: state.videoUri } },
        { text: PROMPT },
      ])
    );

    const findings = extractJSON<UXIssue[]>(result.response.text());
    return { researcherFindings: findings };
  } catch (err) {
    return {
      error: `Researcher failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
