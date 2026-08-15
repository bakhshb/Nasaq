import { useEffect, useState } from "react";

import { getProposedFullName } from "../lib/buildProposedName";
import type { ReviewRow, ValidationIssue } from "../types";

interface Props {
  rootPath: string;
  rows: ReviewRow[];
  separator: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function PreviewDialog({ rootPath, rows, separator, onClose, onConfirm }: Props) {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validate = async () => {
      setLoading(true);
      const existingPaths: Record<string, string> = {};
      for (const row of rows) {
        existingPaths[row.id] = row.absolutePath;
      }
      const proposals = rows.map((row) => {
        const proposedFullName = getProposedFullName(
          row.topic,
          row.documentType,
          row.versionStatus,
          row.extension,
          separator,
        );
        return {
          fileId: row.id,
          proposedName: proposedFullName.replace(row.extension, ""),
          proposedFullName,
        };
      });

      const result = await window.nasaq.validateBatch({
        rootPath,
        proposals,
        existingPaths,
      });
      setIssues(result.issues);
      setLoading(false);
    };
    validate().catch(() => setLoading(false));
  }, [rootPath, rows, separator]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="preview-title">Preview renames</h2>
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </header>

        <p className="modal-note">
          {rows.length} file(s) will be renamed. Nothing is changed until you confirm.
        </p>

        {loading && <p className="modal-note">Validating…</p>}

        {issues.length > 0 && (
          <div className="validation-issues">
            <strong>Validation issues</strong>
            <ul>
              {issues.map((issue, index) => (
                <li key={`${issue.fileId}-${issue.code}-${index}`}>
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="preview-table-wrap">
          <table className="preview-table">
            <thead>
              <tr>
                <th>Current</th>
                <th>→</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td dir="auto">{row.currentFullName}</td>
                  <td>→</td>
                  <td dir="auto">
                    {getProposedFullName(
                      row.topic,
                      row.documentType,
                      row.versionStatus,
                      row.extension,
                      separator,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="modal-footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={loading || issues.some((i) => i.code === "duplicate_proposed_name" || i.code === "invalid_windows_chars")}
          >
            Confirm rename
          </button>
        </footer>
      </div>
    </div>
  );
}
