import React, { useState, useEffect } from 'react';
import { ListNumbers, Link, PushPin, Prohibit } from '@phosphor-icons/react';
import styles from './TabSorterCard.module.css';
import Select from '../../Shared/Select';
import InfoIconWithTooltip from '../../Shared/InfoIconWithTooltip';

const TAB_SORTER_SETTINGS_KEY = 'tabbit_tabsorter_settings';

const DEFAULT_SORTER_SETTINGS = {
  sortBy: "url",
  groupSuspendedTabs: false,
  tabSuspenderExtensionId: "bbomjaikkcabgmfaomdichgcodnaeecf",
  sortPinnedTabs: false
};

export default function TabSorterCard({ onClose }) {
  const [settings, setSettings] = useState(DEFAULT_SORTER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(TAB_SORTER_SETTINGS_KEY, (result) => {
      const saved = result[TAB_SORTER_SETTINGS_KEY] || {};
      setSettings(prev => ({ ...prev, ...saved }));
      setLoading(false);
    });
  }, []);

  const handleSortNow = () => {
    if (working) return;
    setWorking(true);
    chrome.runtime.sendMessage({ type: 'sortTabs' }, () => {
      setWorking(false);
      if (onClose) onClose();
    });
  };

  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    chrome.storage.local.set({ [TAB_SORTER_SETTINGS_KEY]: newSettings });
  };

  if (loading) return null;

  return (
    <div className={styles.tabSorterCard}>
      <div className={styles.header}>
        <span className={styles.title}>
          <ListNumbers size={16} weight="duotone" />
          Tab Sorter Settings
          <InfoIconWithTooltip placement="right">Sorts and organizes all of your open tabs. You can also access this by right-clicking on the Tabbit icon in the Extensions bar.</InfoIconWithTooltip>
        </span>
        <button
          className={`${styles.btnConfirm} ${working ? styles.btnConfirmWorking : ''}`}
          onClick={handleSortNow}
          disabled={working}
        >
          {working ? 'Sorting...' : 'Sort Tabs'}
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.sectionBody}>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingTitle}>
                <Link size={16} weight="duotone" className={styles.settingIcon} />
                Sort By
              </div>
              <div className={styles.settingDesc}>
                Choose whether to sort alphabetically by the Tab's URL or Title.
              </div>
            </div>
            <div className={styles.settingControl}>
              <Select
                className={styles.select}
                value={settings.sortBy}
                onChange={(e) => handleChange('sortBy', e.target.value)}
                options={[
                  { value: 'url', label: 'URL' },
                  { value: 'title', label: 'Title' }
                ]}
              />
            </div>
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingTitle}>
                <PushPin size={16} weight="duotone" className={styles.settingIcon} />
                Sort Pinned Tabs
              </div>
              <div className={styles.settingDesc}>
                Include pinned tabs when organizing and sorting your browser tabs.
              </div>
            </div>
            <div className={styles.settingControl}>
              <input
                type="checkbox"
                className={styles.toggle}
                checked={settings.sortPinnedTabs}
                onChange={(e) => handleChange('sortPinnedTabs', e.target.checked)}
              />
            </div>
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingTitle}>
                <Prohibit size={16} weight="duotone" className={styles.settingIcon} />
                Group Suspended Tabs
              </div>
              <div className={styles.settingDesc}>
                If you use memory-saving extensions like <a href="https://chromewebstore.google.com/detail/tiny-suspender/bbomjaikkcabgmfaomdichgcodnaeecf" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Tiny Suspender</a>, this ensures their URLs are accurately parsed for sorting and optionally grouped together on the left side of your browser.
              </div>
            </div>
            <div className={styles.settingControl}>
              <input
                type="checkbox"
                className={styles.toggle}
                checked={settings.groupSuspendedTabs}
                onChange={(e) => handleChange('groupSuspendedTabs', e.target.checked)}
              />
            </div>
          </div>

          {settings.groupSuspendedTabs && (
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingTitle}>
                  Suspender Extension ID
                </div>
                <div className={styles.settingDesc}>
                  Tabbit defaults to <b>Tiny Suspender</b>. If you use a different one, find it in chrome://extensions and paste its 32-character ID here. You have to sort by URL for this to work.
                </div>
              </div>
              <div className={styles.settingControl}>
                <input
                  type="text"
                  className={styles.textInput}
                  value={settings.tabSuspenderExtensionId}
                  onChange={(e) => handleChange('tabSuspenderExtensionId', e.target.value)}
                />
              </div>
            </div>
          )}

        </div>

        <div className={styles.footerNote}>
          Thank you to <a href="https://chromewebstore.google.com/detail/simple-tab-sorter/cgfpgnepljlgenjclbekbjdlgcodfmjp" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Peter White of Simple Tab Sorter</a> for inspiring this part of the extension.
        </div>
      </div>

    </div>
  );
}
