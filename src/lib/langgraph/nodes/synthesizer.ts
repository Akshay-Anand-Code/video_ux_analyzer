import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AppState } from "../state";
import { callGeminiWithRetry } from "./gemini-utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_INSTRUCTION = `You are a VP of Design synthesizing findings from a UX audit. You produce concise, \
executive-level summaries that help product leaders prioritize. You never list individual issues — you surface \
the overall quality signal and the top 1-2 priority areas.`;

function buildPrompt(validatedJson: string): string {
  return `The UX research team has validated the following findings from a product demo video:

${validatedJson}

Write a 2-3 sentence overall assessment of the product's UX quality and the top 1-2 priority areas to address. \
Return plain text only — no JSON, no markdown, no bullet points.`;
}

export async function synthesizerNode(
  state: AppState
): Promise<Partial<AppState>> {
  try {
    if (state.validatedIssues.length === 0) {
      return {
        overallAssessment:
          "No UX issues were identified in this demo. The product appears to have a clean, conventional user flow for the paths shown.",
      };
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const result = await callGeminiWithRetry(() =>
      model.generateContent(
        buildPrompt(JSON.stringify(state.validatedIssues, null, 2))
      )
    );

    return { overallAssessment: result.response.text().trim() };
  } catch (err) {
    return {
      error: `Synthesizer failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
