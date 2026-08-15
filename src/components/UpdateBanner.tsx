import { useEffect, useState } from "react";

import type { UpdateStatus } from "../types";

export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    window.nasaq.getVersion().then(setAppVersion).catch(() => undefined);

    const unsubscribe = window.nasaq.onUpdateStatus((next) => {
      setStatus(next);
    });

    return unsubscribe;
  }, []);

  if (!status || status.phase === "not-available" || status.phase === "checking") {
    return appVersion ? (
      <div className="version-tag" title="App version">v{appVersion}</div>
    ) : null;
  }

  if (status.phase === "error") {
    return (
      <div className="banner update-banner error">
        <span>Update check failed: {status.message ?? "Unknown error"}</span>
        <button type="button" onClick={() => window.nasaq.checkForUpdates()}>
          Retry
        </button>
      </div>
    );
  }

  if (status.phase === "available") {
    return (
      <div className="banner update-banner info">
        <span>Update v{status.version} is available.</span>
        <button type="button" className="primary" onClick={() => window.nasaq.downloadUpdate()}>
          Download update
        </button>
      </div>
    );
  }

  if (status.phase === "downloading") {
    return (
      <div className="banner update-banner info">
        <span>Downloading update… {Math.round(status.percent ?? 0)}%</span>
      </div>
    );
  }

  if (status.phase === "downloaded") {
    return (
      <div className="banner update-banner success">
        <span>Update v{status.version} is ready.</span>
        <button type="button" className="primary" onClick={() => window.nasaq.installUpdate()}>
          Restart and install
        </button>
      </div>
    );
  }

  return null;
}
