import fs from "fs/promises";
import path from "path";

export interface RenameMove {
  fromPath: string;
  toPath: string;
}

export interface RenameBatch {
  id: string;
  timestamp: string;
  moves: RenameMove[];
  approvalMoves: RenameMove[];
}

export class RenameError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: { fromPath?: string; toPath?: string },
  ) {
    super(message);
    this.name = "RenameError";
  }
}

function pathsAreSame(fromPath: string, toPath: string): boolean {
  const fromResolved = path.resolve(fromPath);
  const toResolved = path.resolve(toPath);
  if (fromResolved === toResolved) {
    return true;
  }
  if (process.platform === "win32") {
    return fromResolved.toLowerCase() === toResolved.toLowerCase();
  }
  return false;
}

export function filterRenameMoves(moves: RenameMove[]): RenameMove[] {
  return moves.filter((move) => !pathsAreSame(move.fromPath, move.toPath));
}

export function toExtendedPath(filePath: string): string {
  if (process.platform !== "win32") {
    return filePath;
  }
  const resolved = path.resolve(filePath);
  if (resolved.startsWith("\\\\?\\")) {
    return resolved;
  }
  if (resolved.startsWith("\\\\")) {
    return `\\\\?\\UNC\\${resolved.slice(2)}`;
  }
  return `\\\\?\\${resolved}`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(toExtendedPath(filePath));
    return true;
  } catch {
    return false;
  }
}

export function buildSourcePathCandidates(
  rootPath: string,
  absolutePath: string,
  relativePath: string,
): string[] {
  const candidates: string[] = [];
  const add = (value: string | undefined) => {
    if (!value) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed || candidates.includes(trimmed)) {
      return;
    }
    candidates.push(trimmed);
  };

  add(absolutePath);
  if (relativePath) {
    add(path.join(rootPath, relativePath));
    add(path.join(rootPath, ...relativePath.split(/[/\\]/)));
  }

  return candidates;
}

export async function resolveExistingSourcePath(
  rootPath: string,
  absolutePath: string,
  relativePath: string,
): Promise<string> {
  for (const candidate of buildSourcePathCandidates(rootPath, absolutePath, relativePath)) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new RenameError(
    "تعذّر العثور على الملف الأصلي. أعد المسح وتأكد أن الملف متاح محلياً (خصوصاً في OneDrive).",
    "source_not_found",
    { fromPath: absolutePath },
  );
}

export function buildTargetPath(sourcePath: string, proposedFullName: string): string {
  return path.join(path.dirname(sourcePath), proposedFullName);
}

async function renamePath(fromPath: string, toPath: string): Promise<void> {
  const fromExtended = toExtendedPath(fromPath);
  const toExtended = toExtendedPath(toPath);

  try {
    await fs.rename(fromExtended, toExtended);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new RenameError(
        "تعذّر العثور على الملف أو المجلد أثناء إعادة التسمية. أعد المسح وتأكد أن الملف غير محذوف وأن OneDrive أكمل المزامنة.",
        "source_not_found",
        { fromPath, toPath },
      );
    }
    if (err.code === "EEXIST" || err.code === "EPERM") {
      throw new RenameError(
        "تعذّر إعادة التسمية لأن الاسم الجديد مستخدم أو مقفل من برنامج آخر.",
        "target_unavailable",
        { fromPath, toPath },
      );
    }
    if (err.code === "ENAMETOOLONG") {
      throw new RenameError(
        "اسم الملف أو المسار طويل جداً على Windows. اختصر أحد أجزاء الاسم.",
        "path_too_long",
        { fromPath, toPath },
      );
    }
    throw error;
  }
}

export interface RenameItemInput {
  absolutePath: string;
  relativePath: string;
  proposedFullName: string;
}

export async function prepareRenameMoves(
  rootPath: string,
  items: RenameItemInput[],
): Promise<RenameMove[]> {
  const moves: RenameMove[] = [];

  for (const item of items) {
    const fromPath = await resolveExistingSourcePath(
      rootPath,
      item.absolutePath,
      item.relativePath,
    );
    const toPath = buildTargetPath(fromPath, item.proposedFullName);
    moves.push({ fromPath, toPath });
  }

  return moves;
}

export async function applyRenames(moves: RenameMove[]): Promise<number> {
  const actionableMoves = filterRenameMoves(moves);
  let applied = 0;

  for (const move of actionableMoves) {
    await renamePath(move.fromPath, move.toPath);
    applied += 1;
  }

  return applied;
}

export async function undoRenames(moves: RenameMove[]): Promise<void> {
  for (const move of [...moves].reverse()) {
    await renamePath(move.toPath, move.fromPath);
  }
}
