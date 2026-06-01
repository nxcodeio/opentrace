import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ViewerSpan {
  id: string;
  traceId: string;
  parentId: string | null;
  name: string;
  kind: string;
  startTime: number;
  endTime?: number;
  status: string;
  attributes: Record<string, unknown>;
  events: Array<{ time: number; name: string; attrs?: Record<string, unknown> }>;
  error?: { message: string; stack?: string };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    costUsd?: number;
  };
}

export interface ViewerTrace {
  id: string;
  serviceName: string;
  rootName: string;
  startTime: number;
  endTime?: number;
  spans: ViewerSpan[];
}

const DIR = process.env.OPENTRACE_DIR ?? join(process.cwd(), ".opentrace");

export async function saveTrace(trace: ViewerTrace): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, `${trace.id}.json`), JSON.stringify(trace, null, 2));
}

export async function listTraces(): Promise<ViewerTrace[]> {
  try {
    const files = await readdir(DIR);
    const traces = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const content = await readFile(join(DIR, f), "utf-8");
            return JSON.parse(content) as ViewerTrace;
          } catch {
            return null;
          }
        }),
    );
    return traces.filter((t): t is ViewerTrace => t !== null).sort((a, b) => b.startTime - a.startTime);
  } catch {
    return [];
  }
}

export async function getTrace(id: string): Promise<ViewerTrace | null> {
  try {
    const content = await readFile(join(DIR, `${id}.json`), "utf-8");
    return JSON.parse(content) as ViewerTrace;
  } catch {
    return null;
  }
}

export function totalCost(trace: ViewerTrace): number {
  return trace.spans.reduce((sum, s) => sum + (s.usage?.costUsd ?? 0), 0);
}

export function totalTokens(trace: ViewerTrace): { input: number; output: number } {
  return trace.spans.reduce(
    (acc, s) => ({
      input: acc.input + (s.usage?.inputTokens ?? 0) + (s.usage?.cacheReadTokens ?? 0) + (s.usage?.cacheWriteTokens ?? 0),
      output: acc.output + (s.usage?.outputTokens ?? 0),
    }),
    { input: 0, output: 0 },
  );
}
