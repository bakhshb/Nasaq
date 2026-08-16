import { useEffect, useState } from "react";

import { CloseIcon } from "./icons";
import type { UpdateStatus } from "../types";

export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = window.nasaq.onUpdateStatus((next) => {
      setStatus(next);
      setDismissed(false);
    });

    return unsubscribe;
  }, []);

  if (!status || dismissed) {
    return null;
  }

  if (status.phase === "not-available" || status.phase === "checking") {
    return null;
  }

  if (status.phase === "error") {
    return (
      <div className="banner update-banner error">
        <span className="update-text">فشل التحقق من التحديثات: {status.message ?? "خطأ غير معروف"}</span>
        <div className="update-actions">
          <button type="button" onClick={() => window.nasaq.checkForUpdates()}>
            إعادة المحاولة
          </button>
          <button type="button" className="ghost" onClick={() => setDismissed(true)} aria-label="إغلاق">
            <CloseIcon />
          </button>
        </div>
      </div>
    );
  }

  if (status.phase === "available") {
    return (
      <div className="banner update-banner">
        <span className="update-text">يتوفر تحديث v{status.version}</span>
        <div className="update-actions">
          <button type="button" className="primary" onClick={() => window.nasaq.downloadUpdate()}>
            Download update
          </button>
          <button type="button" className="ghost" onClick={() => setDismissed(true)} aria-label="إغلاق">
            <CloseIcon />
          </button>
        </div>
      </div>
    );
  }

  if (status.phase === "downloading") {
    return (
      <div className="banner update-banner">
        <span className="update-text">جاري تنزيل التحديث… {Math.round(status.percent ?? 0)}%</span>
      </div>
    );
  }

  if (status.phase === "downloaded") {
    return (
      <div className="banner update-banner success">
        <span className="update-text">التحديث v{status.version} جاهز للتثبيت.</span>
        <div className="update-actions">
          <button type="button" className="primary" onClick={() => window.nasaq.installUpdate()}>
            إعادة التشغيل والتثبيت
          </button>
          <button type="button" className="ghost" onClick={() => setDismissed(true)} aria-label="إغلاق">
            <CloseIcon />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
