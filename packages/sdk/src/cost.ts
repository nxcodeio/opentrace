import type { Usage } from "./types.js";

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  cacheReadPer1M?: number;
  cacheWritePer1M?: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-7": { inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.5, cacheWritePer1M: 18.75 },
  "claude-opus-4-8": { inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.5, cacheWritePer1M: 18.75 },
  "claude-sonnet-4-6": { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.3, cacheWritePer1M: 3.75 },
  "claude-haiku-4-5": { inputPer1M: 0.8, outputPer1M: 4, cacheReadPer1M: 0.08, cacheWritePer1M: 1 },
};

export function priceUsage(model: string, usage: Omit<Usage, "costUsd">): number | undefined {
  const key = Object.keys(PRICING).find((k) => model.startsWith(k));
  if (!key) return undefined;
  const p = PRICING[key]!;
  const inTok = usage.inputTokens ?? 0;
  const outTok = usage.outputTokens ?? 0;
  const cr = usage.cacheReadTokens ?? 0;
  const cw = usage.cacheWriteTokens ?? 0;
  const cost =
    (inTok * p.inputPer1M +
      outTok * p.outputPer1M +
      cr * (p.cacheReadPer1M ?? p.inputPer1M) +
      cw * (p.cacheWritePer1M ?? p.inputPer1M)) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
