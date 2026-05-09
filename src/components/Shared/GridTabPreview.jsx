import React, { useState, useEffect } from "react";
import styles from "./GridTabPreview.module.css";
import {
  captureTab,
  getCachedCapture,
  didCaptureFail,
} from "../../utils/capture";

export default function GridTabPreview({ tab, className, style }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loadingText, setLoadingText] = useState("Capturing preview…");

  useEffect(() => {
    if (!tab) return;
    const cached = getCachedCapture(tab.id);
    if (cached) {
      setImageSrc(cached);
      setLoadingText("");
      return;
    }
    if (didCaptureFail(tab.id)) {
      setImageSrc(null);
      setLoadingText("No preview available");
      return;
    }
    setImageSrc(null);
    setLoadingText("Capturing preview…");
    let isCurrent = true;
    captureTab(tab, (dataUrl) => {
      if (!isCurrent) return;
      if (dataUrl) {
        setImageSrc(dataUrl);
      } else {
        setImageSrc(null);
        setLoadingText("No preview available");
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [tab]);

  return (
    <div className={`${styles.thumbnailContainer} ${className || ""}`} style={style}>
      {!imageSrc && (
        <div className={styles.thumbnailLoading}>{loadingText}</div>
      )}
      {imageSrc && (
        <img
          src={imageSrc}
          className={styles.thumbnailImg}
          alt="Preview"
          draggable="false"
        />
      )}
    </div>
  );
}
