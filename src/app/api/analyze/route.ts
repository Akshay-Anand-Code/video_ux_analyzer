import { NextRequest } from "next/server";
import { uploadVideoToGemini } from "@/lib/gemini";
import { graph } from "@/lib/langgraph/graph";
import type { UXIssue, ValidatedIssue } from "@/types/analysis";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function sse(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          sse({ stage: "uploading", message: "Receiving video file..." })
        );

        const formData = await request.formData();
        const file = formData.get("video") as File | null;

        if (!file || file.size === 0) {
          controller.enqueue(
            sse({ stage: "error", message: "No video file provided." })
          );
          controller.close();
          return;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType = file.type || "video/mp4";

        controller.enqueue(
          sse({
            stage: "processing",
            message: "Uploading to Gemini & processing video...",
          })
        );

        const videoUri = await uploadVideoToGemini(buffer, mimeType);

        controller.enqueue(
          sse({
            stage: "researching",
            message: "UX Researcher is analyzing the video...",
          })
        );

        let researcherFindings: UXIssue[] = [];
        let totalToValidate = 0;
        let validatedCount = 0;

        const graphStream = await graph.stream(
          { videoUri, videoMimeType: mimeType },
          { streamMode: "updates" }
        );

        for await (const chunk of graphStream) {
          if ("researcher" in chunk) {
            if (chunk.researcher?.error) {
              throw new Error(chunk.researcher.error);
            }
            researcherFindings = chunk.researcher?.researcherFindings ?? [];
            totalToValidate = researcherFindings.length;
            controller.enqueue(
              sse({
                stage: "validating",
                event: "researcher_complete",
                researcherFindings,
                message: `Researcher found ${totalToValidate} potential issue${totalToValidate === 1 ? "" : "s"}. Critic is validating in parallel...`,
              })
            );
          }

          if ("critic" in chunk) {
            const newValidated: ValidatedIssue[] = chunk.critic?.validatedIssues ?? [];
            for (const validated of newValidated) {
              validatedCount++;
              controller.enqueue(
                sse({
                  stage: "validating",
                  event: "issue_validated",
                  validatedIssue: validated,
                  progress: { validated: validatedCount, total: totalToValidate },
                })
              );
            }
          }

          if ("synthesizer" in chunk) {
            if (chunk.synthesizer?.error) {
              throw new Error(chunk.synthesizer.error);
            }
            controller.enqueue(
              sse({
                stage: "synthesizing",
                message: "Generating overall assessment...",
              })
            );
            const overallAssessment = chunk.synthesizer?.overallAssessment ?? "";
            controller.enqueue(
              sse({
                stage: "complete",
                overallAssessment,
              })
            );
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        controller.enqueue(sse({ stage: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
