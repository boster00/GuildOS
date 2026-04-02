/**
 * TTS gateway: generateSpeech (Eden text-to-speech).
 * Returns normalized result shape. Stub if endpoint not available.
 */

const { edenPost, truncateRaw } = require("./edenClient");

async function generateSpeech(opts) {
  const { text, voice } = opts;
  const body = {
    model: "audio/text_to_speech/openai/tts-1",
    input: { text: text || "", voice: voice || "alloy" },
  };
  try {
    const { requestId, response, latencyMs } = await edenPost(
      "/v3/universal-ai",
      body,
      "ttsGateway"
    );
    const url = response.output && (response.output.audio_url || response.output.items?.[0]?.audio_url);
    const audioBase64 = response.output && response.output.audio_base64;
    return {
      ok: true,
      requestId,
      latencyMs,
      data: { audioUrl: url, audioBase64 },
      rawPreview: truncateRaw(response),
      raw: response,
    };
  } catch (e) {
    e.requestId = e.requestId || require("./edenClient").generateRequestId();
    throw e;
  }
}

module.exports = {
  generateSpeech,
};
