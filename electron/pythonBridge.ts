import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import readline from "readline";

import { getPythonSpawnOptions } from "./platform/paths";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class PythonBridge {
  private process: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private starting: Promise<void> | null = null;

  async start(): Promise<void> {
    if (this.process) {
      return;
    }
    if (this.starting) {
      return this.starting;
    }

    this.starting = new Promise((resolve, reject) => {
      const { command, args, env } = getPythonSpawnOptions();
      const child = spawn(command, args, {
        env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });

      child.stdin.setDefaultEncoding("utf8");
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      const rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        try {
          const response = JSON.parse(line) as {
            id?: number;
            result?: unknown;
            error?: { code: string; message: string; detail?: string };
          };
          if (response.id === undefined) {
            return;
          }
          const pending = this.pending.get(response.id);
          if (!pending) {
            return;
          }
          this.pending.delete(response.id);
          if (response.error) {
            const detail = response.error.detail ? `\n${response.error.detail}` : "";
            pending.reject(
              new Error(`${response.error.code}: ${response.error.message}${detail}`),
            );
          } else {
            pending.resolve(response.result);
          }
        } catch (error) {
          console.error("Failed to parse Python RPC response:", error, line);
        }
      });

      child.stderr.on("data", (chunk) => {
        console.error("[nasaq-python]", chunk.toString("utf8"));
      });

      child.on("error", (error) => {
        this.process = null;
        this.starting = null;
        this.rejectAll(error);
        reject(error);
      });

      child.on("exit", (code) => {
        this.process = null;
        this.starting = null;
        if (code !== 0 && code !== null) {
          this.rejectAll(new Error(`Python sidecar exited with code ${code}`));
        }
      });

      this.process = child;
      this.call("ping", {})
        .then(() => {
          resolve();
        })
        .catch(reject);
    });

    return this.starting;
  }

  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    await this.start();
    if (!this.process?.stdin.writable) {
      throw new Error("Python sidecar is not running");
    }

    const id = this.nextId++;
    const request = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process?.stdin.write(`${request}\n`, "utf8", (error) => {
        if (error) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.starting = null;
    this.rejectAll(new Error("Python sidecar stopped"));
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending.entries()) {
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}
