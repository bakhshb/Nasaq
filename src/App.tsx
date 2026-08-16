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
import { getProposedFullName } from "./lib/buildProposedName";
import { getFileRenameStatus, hasPendingEdits, type FileFilter } from "./lib/fileStatus";
import { mergeRowsAfterScan } from "./lib/mergeRowsAfterScan";
import type { AnalyzedFile, AppConfig, ReviewRow } from "./types";

function toReviewRow(file: AnalyzedFile): ReviewRow {
  const ext = file.extension || "";
  return {
    id: file.id,
    absolutePath: file.absolutePath,
    relativePath: file.relativePath,
    extension: ext,
    currentName: file.currentName,
    currentFullName: file.currentName + ext,
    documentType: file.documentType,
    topic: file.topic,
    versionStatus: file.versionStatus,
    scannedProposedFullName: file.proposedFullName,
    scannedTopic: file.topic,
    scannedDocumentType: file.documentType,
    scannedVersionStatus: file.versionStatus,
    renameApplied: false,
    selected: false,
    warnings: file.warnings ?? [],
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
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");

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
    [recursive],
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

        const updated = { ...row, ...patch };
        const fieldEdited =
          patch.topic !== undefined ||
          patch.documentType !== undefined ||
          patch.versionStatus !== undefined;

        if (fieldEdited && hasPendingEdits(updated) && getFileRenameStatus(updated, separator) === "needs_rename") {
          return { ...updated, selected: true };
        }

        return updated;
      }),
    );
  };

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const selectedCount = selectedRows.length;

  const getRowProposedFullName = (row: ReviewRow) =>
    getProposedFullName(row.topic, row.documentType, row.versionStatus, row.extension, separator);

  const rowStats = useMemo(() => {
    let organized = 0;
    let needsRename = 0;
    for (const row of rows) {
      const status = getFileRenameStatus(row, separator);
      if (status === "organized") {
        organized += 1;
      } else {
        needsRename += 1;
      }
    }
    return { organized, needsRename };
  }, [rows]);

  const handleSelectRemaining = () => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        selected: getFileRenameStatus(row, separator) === "needs_rename",
      })),
    );
  };

  const handleApplyClick = () => {
    if (selectedCount === 0) {
      setError("حدّد ملفًا واحدًا على الأقل لإعادة التسمية.");
      return;
    }
    setShowPreview(true);
  };

  const handleConfirmRename = async (rowsToRename: ReviewRow[]) => {
    if (!rootPath || rowsToRename.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const items = rowsToRename.map((row) => ({
        id: row.id,
        absolutePath: row.absolutePath,
        proposedFullName: getRowProposedFullName(row),
      }));

      const result = await window.nasaq.renameBatch({ rootPath, items });
      setShowPreview(false);

      if (result.count === 0) {
        setStatusMessage("لم يتغيّر أي اسم — الاسم المقترح مطابق للاسم الحالي.");
        return;
      }

      setStatusMessage(`تمت إعادة تسمية ${result.count} ملف.`);
      setCanUndo(true);
      await scanFolder(rootPath, { preserveStatus: true });
    } catch (err) {
      setError(String(err));
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
                  className={fileFilter === "remaining" ? "filter-btn active" : "filter-btn"}
                  onClick={() => setFileFilter("remaining")}
                >
                  المتبقي ({rowStats.needsRename})
                </button>
                <button
                  type="button"
                  className={fileFilter === "organized" ? "filter-btn active" : "filter-btn"}
                  onClick={() => setFileFilter("organized")}
                >
                  المنظم ({rowStats.organized})
                </button>
              </div>
              <button
                type="button"
                className="toolbar-btn"
                onClick={handleSelectRemaining}
                disabled={rowStats.needsRename === 0 || loading}
              >
                تحديد المتبقي
              </button>
            </div>
            <FileReviewTable
              rows={rows}
              documentTypes={config?.documentTypes ?? []}
              separator={separator}
              filter={fileFilter}
              onUpdateRow={updateRow}
            />
          </>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-meta">
          <span className="footer-selection">
            {rowStats.needsRename} يحتاج تسمية · {rowStats.organized} منظم · {selectedCount} محدد
          </span>
          {appVersion && <span className="footer-version">v{appVersion}</span>}
        </div>
        <button
          type="button"
          className="primary"
          onClick={handleApplyClick}
          disabled={selectedCount === 0 || loading}
        >
          Preview &amp; rename
        </button>
      </footer>

      {showPreview && rootPath && (
        <PreviewDialog
          rootPath={rootPath}
          rows={selectedRows}
          separator={separator}
          onClose={() => setShowPreview(false)}
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
