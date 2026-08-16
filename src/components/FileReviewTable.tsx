import { getProposedFullName } from "../lib/buildProposedName";
import { getFileRenameStatus, type FileFilter } from "../lib/fileStatus";
import type { ReviewRow } from "../types";

interface Props {
  rows: ReviewRow[];
  documentTypes: string[];
  separator: string;
  filter: FileFilter;
  onUpdateRow: (id: string, patch: Partial<ReviewRow>) => void;
}

export default function FileReviewTable({ rows, documentTypes, separator, filter, onUpdateRow }: Props) {
  const rowsWithStatus = rows.map((row) => ({
    row,
    status: getFileRenameStatus(
      row.currentFullName,
      row.topic,
      row.documentType,
      row.versionStatus,
      row.extension,
      separator,
    ),
    proposed: getProposedFullName(
      row.topic,
      row.documentType,
      row.versionStatus,
      row.extension,
      separator,
    ),
  }));

  const visibleRows =
    filter === "remaining"
      ? rowsWithStatus.filter((entry) => entry.status === "needs_rename")
      : filter === "organized"
        ? rowsWithStatus.filter((entry) => entry.status === "organized")
        : rowsWithStatus;

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
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={7} className="table-empty">
                لا توجد ملفات في هذا العرض.
              </td>
            </tr>
          ) : (
            visibleRows.map(({ row, status, proposed }) => {
              const rowClass = [
                row.warnings.includes("low_confidence") ? "low-confidence" : "",
                status === "organized" ? "row-organized" : "row-needs-rename",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <tr key={row.id} className={rowClass}>
                  <td className="col-select">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      disabled={status === "organized"}
                      onChange={(e) => onUpdateRow(row.id, { selected: e.target.checked })}
                    />
                  </td>
                  <td className="col-status">
                    <span className={`status-badge status-${status}`}>
                      {status === "organized" ? "منظم" : "يحتاج تسمية"}
                    </span>
                  </td>
                  <td className="cell-filename" title={row.relativePath} dir="auto">
                    {row.currentFullName}
                  </td>
                  <td>
                    <DocumentTypeCell
                      rowId={row.id}
                      value={row.documentType}
                      options={documentTypes}
                      onChange={(value) => onUpdateRow(row.id, { documentType: value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      type="text"
                      value={row.topic}
                      onChange={(e) => onUpdateRow(row.id, { topic: e.target.value })}
                      dir="auto"
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      type="text"
                      value={row.versionStatus}
                      onChange={(e) => onUpdateRow(row.id, { versionStatus: e.target.value })}
                      dir="auto"
                    />
                  </td>
                  <td className="cell-proposed" dir="auto">{proposed}</td>
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
  rowId,
  value,
  options,
  onChange,
}: {
  rowId: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const datalistId = `doc-types-${rowId}`;
  return (
    <>
      <input
        className="cell-input cell-input-datalist"
        type="text"
        list={datalistId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="auto"
      />
      <datalist id={datalistId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
  );
}
