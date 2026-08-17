import { useCallback, useEffect, useMemo, useState } from "react";

import AppIcon from "./components/AppIcon";
import DocumentTypeManager from "./components/DocumentTypeManager";
import FileReviewTable from "./components/FileReviewTable";
import {
  CloudDownloadIcon,
  DocumentIcon,
  FolderIcon,
  RefreshIcon,
  UndoIcon,
} from "./components/icons";
import PreviewDialog from "./components/PreviewDialog";
import UpdateBanner from "./components/UpdateBanner";
import { applySuccessfulRename, mergeRowsAfterScan } from "./lib/mergeRowsAfterScan";
import { createReviewId } from "./lib/reviewIdentity";
import {
  acceptReviewRow,
  buildRenameItemFromRow,
  canApplyRow,
  countByReviewStatus,
  markRowPendingAfterEdit,
  toReviewApprovalPayload,
  type ReviewFilter,
} from "./lib/reviewWorkflow";
import type { AnalyzedFile, AppConfig, ReviewRow, ReviewStatus } from "./types";

type ScannedFile = AnalyzedFile & {
  reviewId?: string;
  knownAbsolutePaths?: string[];
  reviewStatus?: ReviewStatus;
  acceptedTopic?: string;
  acceptedDocumentType?: string;
  acceptedVersionStatus?: string;
};

function toReviewRow(file: ScannedFile): ReviewRow {
  const ext = file.extension || "";
  const reviewId = file.reviewId?.trim() || createReviewId();
  const knownAbsolutePaths = file.knownAbsolutePaths?.length
    ? [...file.knownAbsolutePaths]
    : [file.absolutePath];
  const reviewStatus: ReviewStatus = file.reviewStatus ?? "pending";

  return {
    id: file.id,
    reviewId,
    absolutePath: file.absolutePath,
    knownAbsolutePaths,
    relativePath: file.relativePath,
    extension: ext,
    currentName: file.currentName,
    currentFullName: file.currentName + ext,
    documentType: file.documentType,
    topic: file.topic,
    versionStatus: file.versionStatus,
    reviewStatus,
    acceptedTopic: file.acceptedTopic ?? "",
    acceptedDocumentType: file.acceptedDocumentType ?? "",
    acceptedVersionStatus: file.acceptedVersionStatus ?? "",
    scannedProposedFullName: file.proposedFullName,
    scannedTopic: file.topic,
    scannedDocumentType: file.documentType,
    scannedVersionStatus: file.versionStatus,
    selected: false,
    warnings: file.warnings ?? [],
    createdAt: file.createdAt,
    createdAtIsBirthtime: file.createdAtIsBirthtime,
    modifiedAt: file.modifiedAt,
  };
}

export default function App() {
  if (typeof window.nasaq === "undefined") {
    return (
      <div className="app">
        <div className="banner error" style={{ margin: "2rem" }}>
          تعذّر تشغيل نسق (لم يتم تحميل جسر سطح المكتب). أعد تثبيت التطبيق أو تواصل مع الدعم.
        </div>
      </div>
    );
  }
  return <MainApp />;
}

function MainApp() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [separator, setSeparator] = useState(" - ");
  const [recursive, setRecursive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewRows, setPreviewRows] = useState<ReviewRow[]>([]);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const [fileFilter, setFileFilter] = useState<ReviewFilter>("all");

  const loadConfig = useCallback(async () => {
    const data = await window.nasaq.getConfig();
    setConfig(data);
    setSeparator(data.naming?.separator ?? " - ");
    setRecursive(data.scan?.recursive ?? false);
  }, []);

  useEffect(() => {
    loadConfig().catch((err) => setError(String(err)));
    window.nasaq.canUndo().then(setCanUndo).catch(() => undefined);
    window.nasaq.getVersion().then(setAppVersion).catch(() => undefined);
  }, [loadConfig]);

  const persistReadyApproval = useCallback(
    async (row: ReviewRow) => {
      if (!rootPath || row.reviewStatus !== "ready") {
        return;
      }
      await window.nasaq.saveReviewApproval({
        rootPath,
        approval: toReviewApprovalPayload(row, separator),
      });
    },
    [rootPath, separator],
  );

  const clearPersistedApproval = useCallback(async (reviewId: string) => {
    if (!reviewId) {
      return;
    }
    await window.nasaq.removeReviewApproval({ reviewId });
  }, []);

  const scanFolder = useCallback(
    async (path: string, options?: { preserveStatus?: boolean }) => {
      setLoading(true);
      setError(null);
      if (!options?.preserveStatus) {
        setStatusMessage(null);
      }
      try {
        const result = await window.nasaq.scanAndAnalyze({ rootPath: path, recursive });
        setRootPath(path);
        setRows((prev) => mergeRowsAfterScan(prev, result.files.map(toReviewRow), separator));
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [recursive, separator],
  );

  const handleSelectFolder = async () => {
    const folder = await window.nasaq.selectFolder();
    if (folder) {
      await scanFolder(folder);
    }
  };

  const handleRescan = () => {
    if (rootPath) {
      scanFolder(rootPath);
    }
  };

  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) {
          return row;
        }
        const updated = markRowPendingAfterEdit(row, patch);
        if (updated.reviewStatus === "pending" && row.reviewStatus !== "pending") {
          void clearPersistedApproval(row.reviewId);
        }
        return updated;
      }),
    );
  };

  const handleAcceptRow = async (id: string) => {
    let acceptedRow: ReviewRow | null = null;
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) {
          return row;
        }
        acceptedRow = acceptReviewRow(row, separator);
        return acceptedRow;
      }),
    );

    if (acceptedRow) {
      if (acceptedRow.reviewStatus === "ready") {
        await persistReadyApproval(acceptedRow);
      } else if (acceptedRow.reviewStatus === "complete") {
        await clearPersistedApproval(acceptedRow.reviewId);
      }
    }
  };

  const handleAcceptSelected = async () => {
    const acceptedRows: ReviewRow[] = [];
    setRows((prev) =>
      prev.map((row) => {
        if (row.selected && row.reviewStatus === "pending") {
          const accepted = acceptReviewRow(row, separator);
          acceptedRows.push(accepted);
          return accepted;
        }
        return row;
      }),
    );

    await Promise.all(
      acceptedRows.map(async (row) => {
        if (row.reviewStatus === "ready") {
          await persistReadyApproval(row);
        } else if (row.reviewStatus === "complete") {
          await clearPersistedApproval(row.reviewId);
        }
      }),
    );
  };

  const selectedApplyableRows = useMemo(
    () => rows.filter((row) => row.selected && canApplyRow(row)),
    [rows],
  );
  const selectedPendingCount = useMemo(
    () => rows.filter((row) => row.selected && row.reviewStatus === "pending").length,
    [rows],
  );

  const rowStats = useMemo(() => countByReviewStatus(rows), [rows]);

  const handleSelectReady = () => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        selected: row.reviewStatus === "ready",
      })),
    );
  };

  const handleSelectPending = () => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        selected: row.reviewStatus === "pending",
      })),
    );
  };

  const handleApplyClick = () => {
    if (selectedApplyableRows.length === 0) {
      setError("حدّد ملفًا واحدًا على الأقل بحالة «جاهز للتطبيق».");
      return;
    }
    setPreviewRows(selectedApplyableRows.map((row) => ({ ...row })));
    setShowPreview(true);
  };

  const handleConfirmRename = async (snapshotRows: ReviewRow[]) => {
    if (!rootPath) {
      setError("لم يتم تحديد مجلد.");
      return;
    }
    if (snapshotRows.length === 0) {
      setError("لا توجد ملفات لتطبيق التسمية.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const items = snapshotRows
        .map((snapshot) => {
          const live = rows.find((row) => row.reviewId === snapshot.reviewId) ?? snapshot;
          return buildRenameItemFromRow(live, separator);
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (items.length === 0) {
        setError("لا توجد ملفات معتمدة جاهزة للتطبيق.");
        setShowPreview(false);
        return;
      }

      const result = await window.nasaq.renameBatch({ rootPath, items });
      setShowPreview(false);
      setPreviewRows([]);

      const resultByReviewId = new Map(result.results.map((entry) => [entry.reviewId, entry]));
      const successes = result.results.filter((entry) => entry.success);
      const failures = result.results.filter((entry) => !entry.success);

      setRows((prev) =>
        prev.map((row) => {
          const outcome = resultByReviewId.get(row.reviewId);
          if (!outcome) {
            return row;
          }
          if (outcome.success) {
            const item = items.find((entry) => entry.reviewId === row.reviewId);
            if (!item) {
              return row;
            }
            return applySuccessfulRename(
              row,
              outcome.fromPath,
              outcome.toPath,
              item.proposedFullName,
              separator,
            );
          }
          return {
            ...row,
            reviewStatus: "ready" as const,
            applyError: outcome.error ?? "تعذّر تطبيق إعادة التسمية.",
          };
        }),
      );

      if (successes.length > 0 && failures.length === 0) {
        setStatusMessage(`تمت إعادة تسمية ${successes.length} ملف.`);
        setCanUndo(true);
      } else if (successes.length > 0 && failures.length > 0) {
        setStatusMessage(`تمت إعادة تسمية ${successes.length} ملف. فشل ${failures.length} ملف — راجع الأخطاء في الجدول.`);
        setCanUndo(true);
        setError(failures.map((entry) => entry.error).filter(Boolean).join(" · "));
      } else if (failures.length > 0) {
        setError(failures.map((entry) => entry.error).filter(Boolean).join(" · "));
      } else {
        setError("لم يُطبَّق أي تغيير. أعد المسح وتأكد أن الملف متاح محلياً (خصوصاً في OneDrive).");
      }

      if (successes.length > 0) {
        await scanFolder(rootPath, { preserveStatus: true });
      }
    } catch (err) {
      const message = String(err);
      if (message.includes("تعذّر العثور على الملف")) {
        setError(`${message} جرّب «إعادة المسح» ثم أعد المحاولة.`);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.nasaq.undoLastRename();
      if (result.undone) {
        setStatusMessage(`تم التراجع (${result.count ?? 0} ملف).`);
        setCanUndo(await window.nasaq.canUndo());
        if (rootPath) {
          await scanFolder(rootPath);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestDocumentType = async (value: string) => {
    if (!config || !value.trim()) {
      return;
    }
    const trimmed = value.trim();
    if (config.documentTypes.includes(trimmed)) {
      return;
    }
    const updated = await window.nasaq.updateConfig({
      documentTypes: [...config.documentTypes, trimmed],
    });
    setConfig(updated);
  };

  const handleSaveDocumentTypes = async (types: string[]) => {
    const updated = await window.nasaq.updateConfig({ documentTypes: types });
    setConfig(updated);
    if (rootPath) {
      await scanFolder(rootPath);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <AppIcon size={44} />
          <div className="brand-text">
            <h1>Nasaq</h1>
            <p className="subtitle">تنظيم أسماء ملفات العمل بشكل متسق</p>
          </div>
        </div>
        <div className="header-actions">
          {appVersion && <span className="header-version">النسخة {appVersion}</span>}
          <button type="button" className="toolbar-btn" onClick={handleSelectFolder} disabled={loading}>
            <FolderIcon />
            تحديد مجلد
          </button>
          <button type="button" className="toolbar-btn" onClick={handleRescan} disabled={!rootPath || loading}>
            <RefreshIcon />
            إعادة المسح
          </button>
          <button type="button" className="toolbar-btn" onClick={() => setShowTypeManager(true)} disabled={loading}>
            <DocumentIcon />
            أنواع المستندات
          </button>
          <button type="button" className="toolbar-btn" onClick={() => window.nasaq.checkForUpdates()} disabled={loading}>
            <CloudDownloadIcon />
            التحقق من التحديثات
          </button>
          <button
            type="button"
            className="toolbar-btn toolbar-btn-undo"
            onClick={handleUndo}
            disabled={!canUndo || loading}
            title="التراجع عن آخر تغيير اسم"
          >
            <UndoIcon size={20} />
            <span>تراجع</span>
          </button>
        </div>
      </header>

      <UpdateBanner />

      <section className="folder-bar">
        <label className="recursive-toggle">
          <input
            type="checkbox"
            checked={recursive}
            onChange={(e) => setRecursive(e.target.checked)}
          />
          مسح المجلدات الفرعية
        </label>
        <div className="folder-path-wrap">
          <span className="folder-path" dir="ltr">
            {rootPath ? rootPath : "لم يتم تحديد مجلد"}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={handleSelectFolder}
            disabled={loading}
            aria-label="تحديد مجلد"
            title="تحديد مجلد"
          >
            <FolderIcon />
          </button>
        </div>
      </section>

      {error && (
        <div className="banner error" dir="ltr">
          {error}
        </div>
      )}
      {statusMessage && <div className="banner success">{statusMessage}</div>}
      {loading && <div className="banner info">جاري العمل…</div>}

      <main className="main-content">
        {rows.length === 0 ? (
          <div className="empty-state">
            <p>حدّد مجلدًا لمسح الملفات ومراجعة الأسماء المقترحة.</p>
          </div>
        ) : (
          <>
            <div className="table-toolbar">
              <div className="filter-group" role="group" aria-label="تصفية الملفات">
                <button
                  type="button"
                  className={fileFilter === "all" ? "filter-btn active" : "filter-btn"}
                  onClick={() => setFileFilter("all")}
                >
                  الكل ({rows.length})
                </button>
                <button
                  type="button"
                  className={fileFilter === "pending" ? "filter-btn active" : "filter-btn"}
                  onClick={() => setFileFilter("pending")}
                >
                  للمراجعة ({rowStats.pending})
                </button>
                <button
                  type="button"
                  className={fileFilter === "ready" ? "filter-btn active" : "filter-btn"}
                  onClick={() => setFileFilter("ready")}
                >
                  جاهز للتطبيق ({rowStats.ready})
                </button>
                <button
                  type="button"
                  className={fileFilter === "complete" ? "filter-btn active" : "filter-btn"}
                  onClick={() => setFileFilter("complete")}
                >
                  مكتمل ({rowStats.complete})
                </button>
              </div>
              <div className="toolbar-actions">
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={handleSelectPending}
                  disabled={rowStats.pending === 0 || loading}
                >
                  تحديد للمراجعة
                </button>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={handleSelectReady}
                  disabled={rowStats.ready === 0 || loading}
                >
                  تحديد الجاهز
                </button>
              </div>
            </div>
            <FileReviewTable
              rows={rows}
              documentTypes={config?.documentTypes ?? []}
              separator={separator}
              filter={fileFilter}
              onUpdateRow={updateRow}
              onAcceptRow={(id) => void handleAcceptRow(id)}
              onSuggestDocumentType={(value) => void handleSuggestDocumentType(value)}
              onFileActionError={(message) => setError(message)}
            />
          </>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-meta">
          <span className="footer-selection">
            {rowStats.pending} للمراجعة · {rowStats.ready} جاهز · {rowStats.complete} مكتمل
          </span>
          {appVersion && <span className="footer-version">v{appVersion}</span>}
        </div>
        <div className="footer-actions">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => void handleAcceptSelected()}
            disabled={selectedPendingCount === 0 || loading}
          >
            اعتماد المحدد ({selectedPendingCount})
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleApplyClick}
            disabled={selectedApplyableRows.length === 0 || loading}
          >
            تطبيق التسمية ({selectedApplyableRows.length})
          </button>
        </div>
      </footer>

      {showPreview && rootPath && (
        <PreviewDialog
          rootPath={rootPath}
          rows={previewRows}
          separator={separator}
          onClose={() => {
            setShowPreview(false);
            setPreviewRows([]);
          }}
          onConfirm={handleConfirmRename}
        />
      )}

      {showTypeManager && config && (
        <DocumentTypeManager
          documentTypes={config.documentTypes}
          onClose={() => setShowTypeManager(false)}
          onSave={handleSaveDocumentTypes}
        />
      )}
    </div>
  );
}
