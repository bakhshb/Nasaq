import fs from "fs/promises";
import path from "path";

import { shell } from "electron";

export type AppPlatform = "win32" | "darwin" | "linux";

export interface FileStatsResult {
  createdAt: string;
  modifiedAt: string;
  /** True when createdAt comes from the filesystem birth time (not ctime fallback). */
  createdAtIsBirthtime: boolean;
}

export interface FileActionResult {
  ok: boolean;
  error?: string;
}

function toIso(date: Date): string {
  return date.toISOString();
}

function resolveCreatedAt(stat: Awaited<ReturnType<typeof fs.stat>>, platform: AppPlatform): {
  createdAt: string;
  createdAtIsBirthtime: boolean;
} {
  if (platform === "win32" || platform === "darwin") {
    return { createdAt: toIso(stat.birthtime), createdAtIsBirthtime: true };
  }

  const birthYear = stat.birthtime.getFullYear();
  if (stat.birthtimeMs > 0 && birthYear > 1980) {
    return { createdAt: toIso(stat.birthtime), createdAtIsBirthtime: true };
  }

  return { createdAt: toIso(stat.ctime), createdAtIsBirthtime: false };
}

async function assertFileExists(absolutePath: string): Promise<void> {
  const resolved = path.resolve(absolutePath);
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) {
    throw new Error("المسار لا يشير إلى ملف");
  }
}

export async function getFileStats(
  absolutePath: string,
  platform: AppPlatform,
): Promise<FileStatsResult> {
  const resolved = path.resolve(absolutePath);
  const stat = await fs.stat(resolved);
  const { createdAt, createdAtIsBirthtime } = resolveCreatedAt(stat, platform);

  return {
    createdAt,
    modifiedAt: toIso(stat.mtime),
    createdAtIsBirthtime,
  };
}

export async function openFile(absolutePath: string): Promise<FileActionResult> {
  try {
    await assertFileExists(absolutePath);
    const error = await shell.openPath(path.resolve(absolutePath));
    if (error) {
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function revealFileInFolder(absolutePath: string): Promise<FileActionResult> {
  try {
    await assertFileExists(absolutePath);
    shell.showItemInFolder(path.resolve(absolutePath));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
