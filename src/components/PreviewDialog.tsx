import { useEffect, useMemo, useState } from "react";

import { getProposedFullName } from "../lib/buildProposedName";
import type { ReviewRow, ValidationIssue } from "../types";

interface Props {
  rootPath: string;
  rows: ReviewRow[];
  separator: string;
  onClose: () => void;
  onConfirm: (rows: ReviewRow[]) => void;
}

function normalizeFilename(name: string): string {
  return name.trim().toLowerCase().normalize("NFC");
}

export default function PreviewDialog({ rootPath, rows, separator, onClose, onConfirm }: Props) {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const hasActualChanges = useMemo(
    () =>
      rows.some((row) => {
        const proposed = getProposedFullName(
          row.topic,
          row.documentType,
          row.versionStatus,
          row.extension,
          separator,
        );
        return normalizeFilename(proposed) !== normalizeFilename(row.currentFullName);
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
          <h2 id="preview-title">معاينة إعادة التسمية</h2>
          <button type="button" className="ghost" onClick={onClose}>إغلاق</button>
        </header>

        <p className="modal-note">
          سيتم إعادة تسمية {rows.length} ملف. لن يتم تغيير أي شيء حتى تؤكد.
        </p>

        {loading && <p className="modal-note">جاري التحقق…</p>}

        {!loading && !hasActualChanges && (
          <div className="validation-issues">
            <strong>لا يوجد تغيير في الأسماء</strong>
            <p className="modal-note">
              الاسم المقترح مطابق للاسم الحالي لكل الملفات المحددة. عدّل الحقول ثم أعد المحاولة.
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
                <th>الجديد</th>
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
            تأكيد إعادة التسمية
          </button>
        </footer>
      </div>
    </div>
  );
}
