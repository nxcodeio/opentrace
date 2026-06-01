import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Exporter, Trace } from "./types.js";

export class HttpExporter implements Exporter {
  constructor(private endpoint: string) {}

  async export(trace: Trace): Promise<void> {
    const url = this.endpoint.replace(/\/$/, "") + "/api/traces";
    try {
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(trace),
      });
    } catch (err) {
      console.warn(`[opentrace] failed to export trace ${trace.id}:`, err);
    }
  }
}

export class FileExporter implements Exporter {
  constructor(private dir: string) {}

  async export(trace: Trace): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const file = join(this.dir, `${trace.id}.json`);
    await writeFile(file, JSON.stringify(trace, null, 2));
  }
}

export class NullExporter implements Exporter {
  async export(): Promise<void> {}
}
