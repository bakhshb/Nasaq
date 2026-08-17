import { useEffect, useMemo, useState } from "react";

import { filenamesMatch } from "../lib/fileStatus";
import { getAcceptedProposedFullName } from "../lib/reviewWorkflow";
import type { ReviewRow, ValidationIssue } from "../types";

interface Props {
  rootPath: string;
  rows: ReviewRow[];
  separator: string;
  onClose: () => void;
  onConfirm: (rows: ReviewRow[]) => void;
}

export default function PreviewDialog({ rootPath, rows, separator, onClose, onConfirm }: Props) {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const hasActualChanges = useMemo(
    () =>
      rows.some((row) => {
        const proposed = getAcceptedProposedFullName(row, separator);
        return !filenamesMatch(proposed, row.currentFullName);
      }),
    [rows, separator],
  );

  useEffect(() => {
    const validate = async () => {
      setLoading(true);
      const existingPaths: Record<string, string> = {};
      for (const row of rows) {
        existingPaths[row.id] = row.absolutePath;
      }
      const proposals = rows.map((row) => {
        const proposedFullName = getAcceptedProposedFullName(row, separator);
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
          <h2 id="preview-title">معاينة تطبيق التسمية</h2>
          <button type="button" className="ghost" onClick={onClose}>إغلاق</button>
        </header>

        <p className="modal-note">
          سيتم إعادة تسمية {rows.length} ملف معتمد. لن يتغيّر أي شيء على القرص حتى تؤكد.
        </p>

        {loading && <p className="modal-note">جاري التحقق…</p>}

        {!loading && !hasActualChanges && (
          <div className="validation-issues">
            <strong>لا يوجد تغيير في الأسماء</strong>
            <p className="modal-note">
              الاسم المعتمد مطابق للاسم الحالي لكل الملفات المحددة.
            </p>
          </div>
        )}

        {issues.length > 0 && (
          <div className="validation-issues">
            <strong>مشكلات التحقق</strong>
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
                <th>الحالي</th>
                <th>→</th>
                <th>المعتمد</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td dir="auto">{row.currentFullName}</td>
                  <td>→</td>
                  <td dir="auto">{getAcceptedProposedFullName(row, separator)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="modal-footer">
          <button type="button" onClick={onClose}>إلغاء</button>
          <button
            type="button"
            className="primary"
            onClick={() => onConfirm(rows)}
            disabled={
              loading ||
              !hasActualChanges ||
              issues.some((i) => i.code === "duplicate_proposed_name" || i.code === "invalid_windows_chars")
            }
          >
            تأكيد التطبيق
          </button>
        </footer>
      </div>
    </div>
  );
}
