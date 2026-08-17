import { useMemo, useState } from "react";

import {
  canSelectRow,
  getDisplayProposedFullName,
  getDraftProposedFullName,
  REVIEW_STATUS_LABELS,
  type ReviewFilter,
} from "../lib/reviewWorkflow";
import type { ReviewRow } from "../types";

interface Props {
  rows: ReviewRow[];
  documentTypes: string[];
  separator: string;
  filter: ReviewFilter;
  onUpdateRow: (id: string, patch: Partial<ReviewRow>) => void;
  onAcceptRow: (id: string) => void;
}

const MANUAL_OPTION = "__manual__";

export default function FileReviewTable({
  rows,
  documentTypes,
  separator,
  filter,
  onUpdateRow,
  onAcceptRow,
}: Props) {
  const rowsWithMeta = rows.map((row) => ({
    row,
    proposed:
      row.reviewStatus === "pending"
        ? getDraftProposedFullName(row, separator)
        : getDisplayProposedFullName(row, separator),
  }));

  const visibleRows =
    filter === "all"
      ? rowsWithMeta
      : rowsWithMeta.filter((entry) => entry.row.reviewStatus === filter);

  return (
    <div className="table-wrap">
      <table className="review-table">
        <thead>
          <tr>
            <th className="col-select">تحديد</th>
            <th className="col-status">الحالة</th>
            <th>اسم الملف الحالي</th>
            <th>نوع المستند</th>
            <th>الموضوع</th>
            <th>الإصدار/الحالة</th>
            <th>اسم الملف المقترح</th>
            <th className="col-action">إجراء</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={8} className="table-empty">
                لا توجد ملفات في هذا العرض.
              </td>
            </tr>
          ) : (
            visibleRows.map(({ row, proposed }) => {
              const rowClass = [
                row.warnings.includes("low_confidence") ? "low-confidence" : "",
                `row-${row.reviewStatus}`,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <tr key={row.id} className={rowClass}>
                  <td className="col-select">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      disabled={!canSelectRow(row)}
                      onChange={(e) => onUpdateRow(row.id, { selected: e.target.checked })}
                    />
                  </td>
                  <td className="col-status">
                    <span className={`status-badge status-${row.reviewStatus}`}>
                      {REVIEW_STATUS_LABELS[row.reviewStatus]}
                    </span>
                  </td>
                  <td className="cell-filename" title={row.relativePath} dir="auto">
                    {row.currentFullName}
                  </td>
                  <td>
                    <DocumentTypeCell
                      key={row.id}
                      value={row.documentType}
                      options={documentTypes}
                      disabled={row.reviewStatus === "complete"}
                      onChange={(value) => onUpdateRow(row.id, { documentType: value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      type="text"
                      value={row.topic}
                      disabled={row.reviewStatus === "complete"}
                      onChange={(e) => onUpdateRow(row.id, { topic: e.target.value })}
                      dir="auto"
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      type="text"
                      value={row.versionStatus}
                      disabled={row.reviewStatus === "complete"}
                      onChange={(e) => onUpdateRow(row.id, { versionStatus: e.target.value })}
                      dir="auto"
                    />
                  </td>
                  <td className="cell-proposed" dir="auto">
                    {proposed}
                  </td>
                  <td className="col-action">
                    {row.reviewStatus === "pending" ? (
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => onAcceptRow(row.id)}
                      >
                        اعتماد
                      </button>
                    ) : row.reviewStatus === "ready" ? (
                      <span className="row-action-note">بانتظار التطبيق</span>
                    ) : (
                      <span className="row-action-note">✓</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function DocumentTypeCell({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const startsInManual = value !== "" && !options.includes(value);
  const [manualMode, setManualMode] = useState(startsInManual);

  const selectValue = useMemo(() => {
    if (options.includes(value)) {
      return value;
    }
    return "";
  }, [options, value]);

  if (manualMode) {
    return (
      <div className="cell-combo">
        <input
          className="cell-input"
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          dir="auto"
          placeholder="اكتب نوع المستند"
        />
        <button
          type="button"
          className="cell-combo-btn"
          disabled={disabled}
          onClick={() => {
            setManualMode(false);
            if (!options.includes(value)) {
              onChange("");
            }
          }}
          title="اختيار من القائمة"
        >
          قائمة
        </button>
      </div>
    );
  }

  return (
    <select
      className="cell-input cell-select"
      value={selectValue}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value;
        if (next === MANUAL_OPTION) {
          setManualMode(true);
          onChange("");
          return;
        }
        onChange(next);
      }}
      dir="auto"
    >
      <option value="">— اختر —</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value={MANUAL_OPTION}>كتابة يدوية...</option>
    </select>
  );
}
