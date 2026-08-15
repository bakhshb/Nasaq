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

export async function applyRenames(moves: RenameMove[]): Promise<void> {
  for (const move of moves) {
    await fs.rename(move.fromPath, move.toPath);
  }
}

export async function undoRenames(moves: RenameMove[]): Promise<void> {
  for (const move of [...moves].reverse()) {
    await fs.rename(move.toPath, move.fromPath);
  }
}

export function buildTargetPath(sourcePath: string, proposedFullName: string): string {
  return path.join(path.dirname(sourcePath), proposedFullName);
}
