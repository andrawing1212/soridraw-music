const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { consumeGeminiInteractionSse } = require("../lib/geminiInteractionSse.js");

const frame = (kind, data) => "event: " + kind + "\r\n" +
  "data: " + JSON.stringify({ event_type: kind, ...data }) + "\r\n\r\n";
const start = frame("step.start", { index: 0, step: { type: "model_output" } });
const text = frame("step.delta", { index: 0, delta: { type: "text", text: "가사 🎵" } });
const complete = frame("interaction.completed", { interaction: { id: "v1_test", model: "gemini-3.6-flash", status: "completed", usage: { total_tokens: 12 } } });
const encoder = new TextEncoder();

function makeResponse(payload, type = "text/event-stream") {
  const parts = Array.isArray(payload) ? payload : [payload];
  let index = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (index < parts.length) controller.enqueue(encoder.encode(parts[index++]));
      else controller.close();
    },
  }), { headers: { "content-type": type } });
}

test("SSE: chunked Korean UTF8, text only, completed usage", async () => {
  const payload = frame("step.start", { index: 1, step: { type: "thought" } }) +
    frame("step.delta", { index: 1, delta: { type: "text", text: "PRIVATE THOUGHT" } }) +
    start + text + complete + "event: done\n" + "data: [DONE]\n\n";
  const chunks = Array.from(encoder.encode(payload), byte => new Uint8Array([byte]));
  let i = 0;
  const res = new Response(new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
  }), { headers: { "content-type": "text/event-stream" } });
  const result = await consumeGeminiInteractionSse(res, "gemini-3.6-flash");
  assert.equal(result.text, "가사 🎵");
  assert.equal(result.responseId, "v1_test");
  assert.equal(result.usage.total_tokens, 12);
});

test("SSE: incomplete stream with partial lyrics must fail", async () => {
  await assert.rejects(consumeGeminiInteractionSse(makeResponse(start + text), "gemini-3.6-flash"),
    e => e.code === "GEMINI_STREAM_INCOMPLETE" && e.status === 502);
});

test("SSE: completed without model text must fail", async () => {
  await assert.rejects(consumeGeminiInteractionSse(makeResponse(complete), "gemini-3.6-flash"),
    e => e.code === "GEMINI_STREAM_INCOMPLETE");
});

test("SSE: provider error never returns partial lyrics or private message", async () => {
  const error = frame("error", { error: { code: "gateway_timeout", message: "SENSITIVE" } });
  await assert.rejects(consumeGeminiInteractionSse(makeResponse(start + text + error), "gemini-3.6-flash"),
    e => e.code === "gateway_timeout" && e.status === 503 && !e.message.includes("SENSITIVE"));
});

test("SSE: broken transport after partial text is rejected", async () => {
  let reads = 0;
  const broken = new Response(new ReadableStream({
    pull(controller) {
      if (reads++ === 0) controller.enqueue(encoder.encode(start + text));
      else controller.error(new Error("transport disconnected"));
    },
  }), { headers: { "content-type": "text/event-stream" } });
  await assert.rejects(consumeGeminiInteractionSse(broken, "gemini-3.6-flash"), /transport disconnected/);
});

test("SSE: completed event is sufficient without a transport [DONE] marker", async () => {
  const result = await consumeGeminiInteractionSse(makeResponse(start + text + complete), "gemini-3.6-flash");
  assert.equal(result.text, "가사 🎵");
  assert.equal(result.usage.total_tokens, 12);
});

test("SSE: invalid JSON and wrong content-type fail closed", async () => {
  await assert.rejects(consumeGeminiInteractionSse(makeResponse("event: step.delta\ndata: {invalid}\n\n"), "gemini-3.6-flash"),
    e => e.code === "GEMINI_STREAM_INVALID");
  await assert.rejects(consumeGeminiInteractionSse(makeResponse(start + text + complete, "application/json"), "gemini-3.6-flash"),
    e => e.code === "GEMINI_STREAM_UNAVAILABLE");
});

test("SSE: oversized frame is rejected", async () => {
  await assert.rejects(consumeGeminiInteractionSse(makeResponse("x".repeat(2 * 1024 * 1024 + 1)), "gemini-3.6-flash"),
    e => e.code === "GEMINI_STREAM_TOO_LARGE");
});

test("SSE: source requests non-stored streaming, never background", () => {
  const source = fs.readFileSync("src/index.ts", "utf8");
  const begin = source.indexOf("const callGeminiInteraction = async");
  const end = source.indexOf("const callGeminiGenerateContent = async", begin);
  assert.ok(begin >= 0 && end > begin);
  const segment = source.slice(begin, end);
  assert.match(segment, /store: false,/);
  assert.match(segment, /stream: true,/);
  assert.match(segment, /consumeGeminiInteractionSse\(upstream, model\)/);
  assert.doesNotMatch(segment, /background: true/);
  console.log("GEMINI_STORE_FALSE_SSE_NO_BACKGROUND=PASS");
});
