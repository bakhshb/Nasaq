import { useCallback, useEffect, useId, useRef, useState } from "react";

import { createdAtLabel, formatFileDate } from "../lib/formatFileDate";
import { MoreVerticalIcon } from "./icons";

interface Props {
  absolutePath: string;
  createdAt?: string;
  createdAtIsBirthtime?: boolean;
  onError?: (message: string) => void;
}

export default function FileRowMenu({
  absolutePath,
  createdAt,
  createdAtIsBirthtime = true,
  onError,
}: Props) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("linux");
  const [liveCreatedAt, setLiveCreatedAt] = useState(createdAt);
  const [liveIsBirthtime, setLiveIsBirthtime] = useState(createdAtIsBirthtime);
  const [loadingStats, setLoadingStats] = useState(false);

  const refreshStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const stats = await window.nasaq.getFileStats(absolutePath);
      setLiveCreatedAt(stats.createdAt);
      setLiveIsBirthtime(stats.createdAtIsBirthtime);
    } catch {
      setLiveCreatedAt(createdAt);
      setLiveIsBirthtime(createdAtIsBirthtime);
    } finally {
      setLoadingStats(false);
    }
  }, [absolutePath, createdAt, createdAtIsBirthtime]);

  useEffect(() => {
    window.nasaq.getPlatform().then(setPlatform).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    refreshStats().catch(() => undefined);

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, refreshStats]);

  const runAction = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setOpen(false);
    const result = await action();
    if (!result.ok && result.error) {
      onError?.(result.error);
    }
  };

  const dateLabel = createdAtLabel(liveIsBirthtime, platform);
  const dateValue = loadingStats ? "جاري التحميل…" : formatFileDate(liveCreatedAt);

  return (
    <div className="file-row-menu" ref={rootRef}>
      <button
        type="button"
        className="file-row-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="خيارات الملف"
        title="خيارات الملف"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVerticalIcon size={18} />
      </button>
      {open && (
        <div className="file-row-menu-panel" id={menuId} role="menu">
          <button
            type="button"
            className="file-row-menu-item"
            role="menuitem"
            onClick={() => runAction(() => window.nasaq.openFile(absolutePath))}
          >
            فتح الملف
          </button>
          <button
            type="button"
            className="file-row-menu-item"
            role="menuitem"
            onClick={() => runAction(() => window.nasaq.revealInFolder(absolutePath))}
          >
            فتح موقع الملف
          </button>
          <div className="file-row-menu-info" role="presentation">
            <span className="file-row-menu-info-label">{dateLabel}</span>
            <span className="file-row-menu-info-value" dir="ltr">
              {dateValue}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
