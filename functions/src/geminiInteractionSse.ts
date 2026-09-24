// SORIDRAW_GEMINI_INTERACTION_SSE_162
// Only accepts complete model_output streams; never returns unfinished lyrics.
// Pure local parser: no requests, user data persistence, or external dependencies.
export type GeminiInteractionStreamResult = {
  text: string;
  usage: Record<string, any>;
  responseId: string | undefined;
  model: string;
};

const MAX_STREAM_BUFFER = 2 * 1024 * 1024;
const MAX_STREAM_TOTAL = 5 * 1024 * 1024;
const MAX_OUTPUT_TEXT = 2 * 1024 * 1024;

function streamError(message: string, code: string, status: number): Error {
  const error = new Error(message);
  (error as any).code = code;
  (error as any).status = status;
  return error;
}

export async function consumeGeminiInteractionSse(
  response: Response,
  expectedModel: string,
): Promise<GeminiInteractionStreamResult> {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("text/event-stream") || !response.body) {
    throw streamError("Gemini stream response is unavailable", "GEMINI_STREAM_UNAVAILABLE", 502);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pendingEvent = "";
  let pendingData: string[] = [];
  let totalBytes = 0;
  let text = "";
  let completed: any = null;
  let sawDone = false;
  const outputSteps = new Set<number>();

  function emit(): void {
    const raw = pendingData.join("\n");
    const namedEvent = pendingEvent;
    pendingData = [];
    pendingEvent = "";
    if (!raw || raw === "[DONE]") {
      if (raw === "[DONE]") sawDone = true;
      return;
    }
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw streamError("Malformed Gemini stream event", "GEMINI_STREAM_INVALID", 502);
    }
    const kind = String(payload?.event_type || namedEvent || "").trim();
    if (kind === "error") {
      const reason = String(payload?.error?.code || payload?.error?.status || "");
      // Never include raw provider messages or prompt fragments in error logs.
      const status = Number(payload?.error?.statusCode || payload?.error?.status_code || payload?.error?.code);
      throw streamError("Gemini stream reported an error", reason.slice(0, 90) || "GEMINI_STREAM_UPSTREAM_ERROR",
        Number.isInteger(status) && status >= 400 && status <= 599 ? status : 503);
    }
    if (kind === "step.start") {
      const index = Number(payload?.index);
      if (Number.isInteger(index) && payload?.step?.type === "model_output") outputSteps.add(index);
      return;
    }
    if (kind === "step.delta") {
      if (completed) throw streamError("Gemini sent output after completion", "GEMINI_STREAM_INVALID", 502);
      const index = Number(payload?.index);
      if (outputSteps.has(index) && payload?.delta?.type === "text") {
        text += String(payload?.delta?.text || "");
        if (text.length > MAX_OUTPUT_TEXT) {
          throw streamError("Gemini output exceeds safety limit", "GEMINI_STREAM_TOO_LARGE", 502);
        }
      }
      return;
    }
    if (kind === "step.stop") {
      const index = Number(payload?.index);
      outputSteps.delete(index);
      return;
    }
    if (kind === "interaction.completed") {
      if (completed) throw streamError("Repeated Gemini completion", "GEMINI_STREAM_INVALID", 502);
      const interaction = payload?.interaction;
      if (interaction?.status !== "completed") {
        throw streamError("Gemini interaction did not complete", "GEMINI_STREAM_INCOMPLETE", 502);
      }
      completed = interaction;
    }
  }

  function feed(piece: string): void {
    buffer += piece;
    if (buffer.length > MAX_STREAM_BUFFER) {
      throw streamError("Gemini stream buffer exceeds safety limit", "GEMINI_STREAM_TOO_LARGE", 502);
    }
    let end: number;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end).replace(/\r$/, "");
      buffer = buffer.slice(end + 1);
      if (!line) {
        emit();
      } else if (line.startsWith("event:")) {
        pendingEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        pendingData.push(line.slice(5).replace(/^ /, ""));
      }
      // Ignore protocol comments, IDs, and retry fields.
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      totalBytes += value?.byteLength || 0;
      if (totalBytes > MAX_STREAM_TOTAL) {
        throw streamError("Gemini stream exceeds safety limit", "GEMINI_STREAM_TOO_LARGE", 502);
      }
      feed(decoder.decode(value, { stream: true }));
    }
    feed(decoder.decode());
    if (buffer) feed("\n");
    if (pendingData.length || pendingEvent) emit();
    if (!completed || !text.trim()) {
      throw streamError("Gemini stream ended without completed model output", "GEMINI_STREAM_INCOMPLETE", 502);
    }
    // [DONE] is a transport terminator and not an alternative success signal.
    // Some intermediaries close an SSE stream without [DONE] after the completed event.
    void sawDone;
    return {
      text,
      usage: (completed.usage && typeof completed.usage === "object") ? completed.usage : {},
      responseId: String(completed.id || "") || undefined,
      model: String(completed.model || expectedModel),
    };
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
