import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export async function uploadVideoToGemini(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

  const ext = mimeType.split("/")[1]?.split(";")[0] ?? "mp4";
  const tempPath = join(tmpdir(), `ux_demo_${Date.now()}.${ext}`);
  writeFileSync(tempPath, buffer);

  let uploadResponse;
  try {
    uploadResponse = await fileManager.uploadFile(tempPath, {
      mimeType,
      displayName: `ux_demo_${Date.now()}`,
    });
  } finally {
    try { unlinkSync(tempPath); } catch { /* ignore cleanup errors */ }
  }

  let file = await fileManager.getFile(uploadResponse.file.name);
  while (file.state === FileState.PROCESSING) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await fileManager.getFile(uploadResponse.file.name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error(
      "Gemini video processing failed. Try a shorter or smaller video file."
    );
  }

  return file.uri;
}
