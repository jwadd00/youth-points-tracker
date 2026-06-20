"use client";

import { useEffect, useState } from "react";

export default function SaveToast({
  show,
  title = "Saved",
  message = "Your changes have been saved."
}) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;
    setVisible(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, [show]);

  if (!visible) return null;

  return (
    <div className="toastPanel" role="status" aria-live="polite">
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <button className="toastClose" type="button" onClick={() => setVisible(false)} aria-label="Dismiss saved message">
        x
      </button>
    </div>
  );
}
