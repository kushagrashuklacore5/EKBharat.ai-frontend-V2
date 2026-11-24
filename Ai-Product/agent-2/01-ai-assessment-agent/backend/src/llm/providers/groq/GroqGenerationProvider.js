const { QuestionGenerationProvider, LlmProviderError } = require('../../QuestionGenerationProvider');

/**
 * Groq (OpenAI-compatible chat completions, JSON mode). Added in LMS commit e86611d.
 *
 * [standalone audit fix] Errors now follow the provider contract in QuestionGenerationProvider.js, like the
 * Gemini and Hugging Face providers: HTTP status -> AUTH_FAILED / MODEL_NOT_FOUND / RATE_LIMITED / QUOTA_EXCEEDED /
 * UNAVAILABLE / BAD_REQUEST, unreadable or empty replies -> BAD_RESPONSE, and messages never contain the provider's
 * response body. (Before, every HTTP error was "BAD_STATUS" with the body in the message, so a wrong key or a rate
 * limit reached teachers as "AI service unavailable".) The request itself is unchanged.
 */
const DEFAULT_URL = 'https://api.groq.com/openai/v1/chat/completions';

function errorForStatus(status) {
  if (status === 401 || status === 403) return new LlmProviderError('The AI service rejected the configured credentials.', { code: 'AUTH_FAILED', status });
  if (status === 404) return new LlmProviderError('The configured AI model was not found.', { code: 'MODEL_NOT_FOUND', status });
  if (status === 429) return new LlmProviderError('The AI service is rate limiting requests.', { code: 'RATE_LIMITED', status });
  if (status === 402) return new LlmProviderError('The AI service usage limit has been reached.', { code: 'QUOTA_EXCEEDED', status });
  if (status >= 500) return new LlmProviderError('The AI service is unavailable.', { code: 'UNAVAILABLE', status });
  return new LlmProviderError('The AI service rejected the request.', { code: 'BAD_REQUEST', status });
}

class GroqGenerationProvider extends QuestionGenerationProvider {
  constructor({ apiKey, model = 'openai/gpt-oss-120b', url = DEFAULT_URL, fetchImpl = globalThis.fetch, temperature = 0.3 } = {}) {
    super('groq');
    if (typeof apiKey !== 'string' || apiKey.trim() === '') throw new TypeError('GroqGenerationProvider requires an API key.');
    if (typeof fetchImpl !== 'function') throw new TypeError('GroqGenerationProvider requires fetch.');
    this.model = model;
    this.url = url;
    this.temperature = temperature;
    Object.defineProperty(this, 'apiKey', { value: apiKey, enumerable: false });
    Object.defineProperty(this, 'fetchImpl', { value: fetchImpl, enumerable: false });
  }

  async generateJson({ systemInstruction, prompt, signal } = {}) {
    const messages = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    messages.push({ role: 'user', content: prompt });

    let response;
    try {
      response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, temperature: this.temperature, response_format: { type: 'json_object' } }),
        signal,
      });
    } catch (err) {
      if (err && err.name === 'AbortError') throw err; // the caller's timeout
      throw new LlmProviderError('Could not reach the AI service.', { code: 'NETWORK_ERROR' });
    }

    if (!response.ok) {
      await response.text().catch(() => ''); // drain; never surfaced (it may echo the request)
      throw errorForStatus(response.status);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new LlmProviderError('The AI service returned an unreadable response.', { code: 'BAD_RESPONSE', status: response.status });
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new LlmProviderError('The AI service returned no content.', { code: 'BAD_RESPONSE' });
    }
    return content;
  }
}

module.exports = { GroqGenerationProvider, errorForStatus };
