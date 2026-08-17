import { useEffect, useMemo, useState } from "react";

import { filenamesMatch } from "../lib/fileStatus";
import {
  getRenameProposedFullName,
  proposedStemFromFullName,
} from "../lib/reviewWorkflow";
import type { ReviewRow, ValidationIssue } from "../types";

interface Props {
  rootPath: string;
  rows: ReviewRow[];
  separator: string;
  onClose: () => void;
  onConfirm: (rows: ReviewRow[]) => Promise<void>;
}

const BLOCKING_VALIDATION_CODES = new Set([
  "duplicate_proposed_name",
  "invalid_windows_chars",
  "source_not_found",
  "target_exists",
  "empty_proposed_name",
  "reserved_windows_name",
  "name_too_long",
]);

const VALIDATION_LABELS: Record<string, string> = {
  source_not_found:
    "الملف الأصلي غير موجود على القرص. أعد المسح وتأكد من اكتمال مزامنة OneDrive.",
  target_exists: "يوجد ملف آخر بنفس الاسم المستهدف في المجلد.",
  duplicate_proposed_name: "اسم مستهدف مكرر بين الملفات المحددة.",
  invalid_windows_chars: "الاسم يحتوي أحرفاً غير مسموحة في Windows.",
  empty_proposed_name: "الاسم المقترح فارغ.",
  reserved_windows_name: "الاسم محجوز في Windows.",
  name_too_long: "الاسم أو أحد أجزائه طويل جداً.",
  no_extension: "الملف بلا امتداد.",
};

function validationMessage(issue: ValidationIssue): string {
  return VALIDATION_LABELS[issue.code] ?? issue.message;
}

export default function PreviewDialog({ rootPath, rows, separator, onClose, onConfirm }: Props) {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const hasActualChanges = useMemo(
    () =>
      rows.some((row) => {
        const proposed = getRenameProposedFullName(row, separator);
        return proposed !== "" && !filenamesMatch(proposed, row.currentFullName);
      }),
    [rows, separator],
  );

  const blockingIssues = useMemo(
    () => issues.filter((issue) => BLOCKING_VALIDATION_CODES.has(issue.code)),
    [issues],
  );

  useEffect(() => {
    const validate = async () => {
      setLoading(true);
      const existingPaths: Record<string, string> = {};
      for (const row of rows) {
        existingPaths[row.id] = row.absolutePath;
      }
      const proposals = rows.map((row) => {
        const proposedFullName = getRenameProposedFullName(row, separator);
        return {
          fileId: row.id,
          proposedName: proposedStemFromFullName(row, proposedFullName),
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

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(rows);
    } finally {
      setConfirming(false);
    }
  };

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
              الاسم المعتمد مطابق للاسم الحالي لكل الملفات المحددة. أعد المسح إذا غيّرت الملفات خارج التطبيق.
            </p>
          </div>
        )}

        {blockingIssues.length > 0 && (
          <div className="validation-issues">
            <strong>لا يمكن التطبيق حتى تُحل هذه المشكلات</strong>
            <ul>
              {blockingIssues.map((issue, index) => (
                <li key={`${issue.fileId}-${issue.code}-${index}`}>
                  {validationMessage(issue)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {issues.length > blockingIssues.length && (
          <div className="validation-issues">
            <strong>تنبيهات</strong>
            <ul>
              {issues
                .filter((issue) => !BLOCKING_VALIDATION_CODES.has(issue.code))
                .map((issue, index) => (
                  <li key={`${issue.fileId}-${issue.code}-warn-${index}`}>
                    {validationMessage(issue)}
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
                  <td dir="auto">{getRenameProposedFullName(row, separator)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="modal-footer">
          <button type="button" onClick={onClose} disabled={confirming}>إلغاء</button>
          <button
            type="button"
            className="primary"
            onClick={() => void handleConfirm()}
            disabled={
              loading ||
              confirming ||
              !hasActualChanges ||
              blockingIssues.length > 0
            }
          >
            {confirming ? "جاري التطبيق…" : "تأكيد التطبيق"}
          </button>
        </footer>
      </div>
    </div>
  );
}
