import FileRowMenu from "./FileRowMenu";
import {
  canSelectRow,
  draftMatchesDisk,
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
  onSuggestDocumentType: (value: string) => void;
  onFileActionError?: (message: string) => void;
}

const DOCUMENT_TYPE_DATALIST_ID = "document-type-options";

export default function FileReviewTable({
  rows,
  documentTypes,
  separator,
  filter,
  onUpdateRow,
  onAcceptRow,
  onSuggestDocumentType,
  onFileActionError,
}: Props) {
  const rowsWithMeta = rows.map((row) => ({
    row,
    proposed:
      row.reviewStatus === "pending"
        ? getDraftProposedFullName(row, separator)
        : getDisplayProposedFullName(row, separator),
    approveAsIs: row.reviewStatus === "pending" && draftMatchesDisk(row, separator),
  }));

  const visibleRows =
    filter === "all"
      ? rowsWithMeta
      : rowsWithMeta.filter((entry) => entry.row.reviewStatus === filter);

  return (
    <div className="table-wrap">
      <datalist id={DOCUMENT_TYPE_DATALIST_ID}>
        {documentTypes.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
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
            visibleRows.map(({ row, proposed, approveAsIs }) => {
              const rowClass = [
                row.warnings.includes("low_confidence") ? "low-confidence" : "",
                `row-${row.reviewStatus}`,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <tr key={row.reviewId} className={rowClass}>
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
                    {row.applyError && (
                      <div className="row-error" title={row.applyError}>
                        {row.applyError}
                      </div>
                    )}
                  </td>
                  <td className="cell-filename" dir="auto">
                    <div className="cell-filename-wrap">
                      <span className="cell-filename-text" title={row.relativePath}>
                        {row.currentFullName}
                      </span>
                      <FileRowMenu
                        absolutePath={row.absolutePath}
                        createdAt={row.createdAt}
                        createdAtIsBirthtime={row.createdAtIsBirthtime}
                        onError={onFileActionError}
                      />
                    </div>
                  </td>
                  <td>
                    <DocumentTypeCell
                      value={row.documentType}
                      disabled={row.reviewStatus === "complete"}
                      onChange={(value) => onUpdateRow(row.id, { documentType: value })}
                      onSuggestNew={onSuggestDocumentType}
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
                        className={approveAsIs ? "row-action-btn row-action-btn-as-is" : "row-action-btn"}
                        onClick={() => onAcceptRow(row.id)}
                        title={
                          approveAsIs
                            ? "الاسم على القرص مطابق للمقترح — اعتماد دون إعادة تسمية"
                            : "اعتماد الاسم المقترح للتطبيق لاحقاً"
                        }
                      >
                        {approveAsIs ? "اعتماد كما هو" : "اعتماد"}
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
  disabled,
  onChange,
  onSuggestNew,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSuggestNew: (value: string) => void;
}) {
  return (
    <input
      className="cell-input"
      type="text"
      list={DOCUMENT_TYPE_DATALIST_ID}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        const next = e.target.value.trim();
        if (next) {
          onSuggestNew(next);
        }
      }}
      dir="auto"
      placeholder="اختر أو اكتب نوع المستند"
    />
  );
}
