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

export async function applyRenames(moves: RenameMove[]): Promise<number> {
  let applied = 0;
  for (const move of filterRenameMoves(moves)) {
    await fs.rename(move.fromPath, move.toPath);
    applied += 1;
  }
  return applied;
}

export async function undoRenames(moves: RenameMove[]): Promise<void> {
  for (const move of [...moves].reverse()) {
    await fs.rename(move.toPath, move.fromPath);
  }
}

export function buildTargetPath(sourcePath: string, proposedFullName: string): string {
  return path.join(path.dirname(sourcePath), proposedFullName);
}
