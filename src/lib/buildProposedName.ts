/** String assembly only — no filename understanding logic. */

export function buildProposedName(
  topic: string,
  documentType: string,
  versionStatus: string,
  separator = " - ",
): string {
  const parts: string[] = [];
  const t = topic.trim();
  const d = documentType.trim();
  const v = versionStatus.trim();
  if (t) parts.push(t);
  if (d) parts.push(d);
  if (v) parts.push(v);
  return parts.join(separator);
}

export function buildProposedFullName(proposedName: string, extension: string): string {
  if (!proposedName) {
    return extension.startsWith(".") ? extension.slice(1) : extension;
  }
  const ext = extension.startsWith(".") ? extension : extension ? `.${extension}` : "";
  return `${proposedName}${ext}`;
}

export function getProposedFullName(
  topic: string,
  documentType: string,
  versionStatus: string,
  extension: string,
  separator = " - ",
): string {
  return buildProposedFullName(
    buildProposedName(topic, documentType, versionStatus, separator),
    extension,
  );
}
