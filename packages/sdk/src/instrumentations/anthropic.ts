import { priceUsage } from "../cost.js";
import type { Tracer } from "../tracer.js";

export function instrumentAnthropic(client: unknown, tracer: Tracer): unknown {
  const c = client as { messages?: { create?: Function } };
  if (!c?.messages?.create) return client;

  const original = c.messages.create.bind(c.messages);

  c.messages.create = async function patched(params: any, ...rest: any[]) {
    const startTime = Date.now();
    const attributes: Record<string, unknown> = {
      "llm.provider": "anthropic",
      "llm.model": params?.model,
      "llm.request.max_tokens": params?.max_tokens,
      "llm.request.system": params?.system,
      "llm.request.messages": params?.messages,
      "llm.request.tools": params?.tools,
      "llm.request.temperature": params?.temperature,
    };

    try {
      const response: any = await original(params, ...rest);
      const endTime = Date.now();
      const usage = response?.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            cacheReadTokens: response.usage.cache_read_input_tokens,
            cacheWriteTokens: response.usage.cache_creation_input_tokens,
          }
        : undefined;
      const costUsd = usage && params?.model ? priceUsage(params.model, usage) : undefined;

      attributes["llm.response.id"] = response?.id;
      attributes["llm.response.stop_reason"] = response?.stop_reason;
      attributes["llm.response.content"] = response?.content;

      tracer.recordLlmSpan({
        name: `anthropic.messages.create ${params?.model ?? ""}`.trim(),
        attributes,
        usage: usage ? { ...usage, costUsd } : undefined,
        startTime,
        endTime,
      });

      return response;
    } catch (err) {
      tracer.recordLlmSpan({
        name: `anthropic.messages.create ${params?.model ?? ""}`.trim(),
        attributes,
        startTime,
        endTime: Date.now(),
        error: err,
      });
      throw err;
    }
  };

  return client;
}
