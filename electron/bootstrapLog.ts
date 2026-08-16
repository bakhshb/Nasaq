import fs from "fs";
import path from "path";

/** Write before Electron app is ready — uses fixed Windows-friendly paths. */
export function bootstrapLog(message: string): void {
  const line = `${new Date().toISOString()} ${message}\n`;
  const targets = [
    path.join(process.env.APPDATA || "", "Nasaq", "logs", "startup.log"),
    path.join(process.env.APPDATA || "", "nasaq", "logs", "startup.log"),
    path.join(process.env.TEMP || "", "Nasaq-startup.log"),
  ];

  for (const logPath of targets) {
    try {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(logPath, line, "utf8");
    } catch {
      // ignore
    }
  }
}
