import React from "react";
import styles from "./PreviewGrid.module.css";
import Favicon from "../../Shared/Favicon";
import GridTabPreview from "../../Shared/GridTabPreview";

export default function PreviewGrid({ previewTabs }) {
  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeader}>
        <span className={styles.previewTitle}>
          Preview ({previewTabs.length} matched)
        </span>
      </div>
      <div className={styles.previewGridScroll}>
        {previewTabs.length === 0 ? (
          <div className={styles.emptyState}>
            <span>No currently open tabs match.</span>
          </div>
        ) : (
          <div className={styles.previewGrid}>
            {previewTabs.map((tab) => (
              <div key={tab.id} className={styles.previewCard}>
                <div className={styles.previewCardTop}>
                  <Favicon
                    src={tab.favIconUrl}
                    size={16}
                    className={styles.gridFavicon}
                    fallbackClass={styles.gridFaviconFallback}
                  />
                </div>
                <div className={styles.previewCardInfo}>
                  <div className={styles.previewCardTitle}>
                    {tab.title || "(Untitled)"}
                  </div>
                  <div className={styles.previewCardUrl}>{tab.url}</div>
                  <GridTabPreview tab={tab} className={styles.grouperThumbnailOverride} />
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 10,
                      color: `var(--chrome-${tab.matchedRule?.groupColor}, grey)`,
                      fontWeight: 600,
                    }}
                  >
                    → {tab.matchedRule?.groupName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
