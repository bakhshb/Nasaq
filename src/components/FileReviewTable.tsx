import { getProposedFullName } from "../lib/buildProposedName";
import type { ReviewRow } from "../types";
import { ChevronDownIcon } from "./icons";

interface Props {
  rows: ReviewRow[];
  documentTypes: string[];
  separator: string;
  onUpdateRow: (id: string, patch: Partial<ReviewRow>) => void;
}

export default function FileReviewTable({ rows, documentTypes, separator, onUpdateRow }: Props) {
  return (
    <div className="table-wrap">
      <table className="review-table">
        <thead>
          <tr>
            <th className="col-select">تحديد</th>
            <th>اسم الملف الحالي</th>
            <th>نوع المستند</th>
            <th>الموضوع</th>
            <th>الإصدار/الحالة</th>
            <th>اسم الملف المقترح</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const proposed = getProposedFullName(
              row.topic,
              row.documentType,
              row.versionStatus,
              row.extension,
              separator,
            );
            return (
              <tr key={row.id} className={row.warnings.includes("low_confidence") ? "low-confidence" : ""}>
                <td className="col-select">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(e) => onUpdateRow(row.id, { selected: e.target.checked })}
                  />
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
          })}
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
    <div className="cell-input-wrap">
      <input
        className="cell-input with-chevron"
        type="text"
        list={datalistId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="auto"
      />
      <ChevronDownIcon className="cell-chevron" />
      <datalist id={datalistId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </div>
  );
}
