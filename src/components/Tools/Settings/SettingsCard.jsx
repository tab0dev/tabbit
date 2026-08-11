import React, { useState, useEffect } from 'react';
import { Gear, SortAscending, Info, Warning, CheckCircle, Robot, Television, MusicNoteSimpleIcon, Moon, Pause, Lightning } from '@phosphor-icons/react';
import { isAiAvailable } from '../../../services/aiGroupingService';
import styles from './SettingsCard.module.css';
import { useTabProcessing } from '../../../store/TabProcessingProvider';
import { useTutorial } from '../../../hooks/useTutorial';
import { useTheme } from '../../../store/ThemeProvider';
import { useCRTEffect } from '../../../store/CRTEffectProvider';
import { useMusic } from '../../../store/music/MusicProvider';
import { useHasSuspendedTabs } from '../../../store/TriageProvider';
import Select from '../../Shared/Select';
import AiOptInModal from '../../Modals/AiOptInModal';

// each setting declares its own getValue + onChange so the renderer
// stays generic. no more id-matching switch statements.
function buildSettingsSections(ctx) {
  return [
    {
      id: 'general',
      title: 'General',
      settings: [
        {
          id: 'sort_order',
          title: 'Stack Order',
          icon: SortAscending,
          description: 'Change the sort order of the tabs in the stack',
          type: 'select',
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'oldest_first', label: 'Oldest First' },
            { value: 'newest_first', label: 'Newest First' },
            { value: 'group_by_site', label: 'Group by Site' },
            { value: 'alphabetical', label: 'Alphabetical' },
            { value: 'random', label: 'Random' },
          ],
          getValue: () => ctx.mode,
          onChange: (e) => ctx.setMode(e.target.value),
        },
        {
          id: 'theme_toggle',
          title: 'Light Mode',
          icon: Moon,
          description: 'Switch between light and dark modes',
          type: 'toggle',
          getValue: () => ctx.theme === 'light',
          onChange: () => ctx.toggleTheme(),
        },
        {
          id: 'reduce_motion',
          title: 'Disable Dashboard Transitions',
          icon: Lightning,
          description: 'Disable animations between the main view and the feature cards.',
          type: 'toggle',
          getValue: () => ctx.reduceMotion,
          onChange: () => ctx.toggleReduceMotion(),
        },
      ],
    },
    {
      id: 'extra',
      title: 'Extra',
      settings: [
        {
          id: 'ai_model_management',
          title: 'Manage Local AI Models',
          icon: Robot,
          description: "Enable Chrome's offline, local Gemini Nano model only for context-aware tab grouping",
          type: 'custom',
        },
        {
          id: 'exclude_suspended_tabs',
          title: 'Exclude Suspended Tabs',
          icon: Pause,
          description: 'Hide tabs paused by a tab suspender extension from the card stack & auto tab grouper',
          type: 'toggle',
          getValue: () => ctx.excludeSuspendedTabs,
          onChange: (e) => ctx.setExcludeSuspendedTabs(e.target.checked),
          condition: () => ctx.hasSuspendedTabs,
        },
        {
          id: 'suspender_extension_id',
          title: 'Suspender Extension ID',
          icon: Pause,
          description: 'Defaults to Tiny Suspender. If you use a different one, find its 32-character ID in chrome://extensions and paste it here',
          type: 'text_input',
          getValue: () => ctx.suspenderExtensionId,
          onChange: (e) => {
            const val = e.target.value;
            ctx.setSuspenderExtensionId(val);
            localStorage.setItem('suspenderExtensionId', val);
          },
          // only visible when suspended tabs are being included
          condition: () => !ctx.excludeSuspendedTabs,
        },
      ],
    },
    {
      id: 'popups',
      title: 'Popups',
      settings: [
        {
          id: 'show_tutorial_startup',
          title: 'Show Tutorial on Startup',
          icon: Info,
          description: 'Always show the controls modal when the app opens',
          type: 'toggle',
          getValue: () => !ctx.isTutorialDisabled,
          onChange: (e) => ctx.setTutorialDisabled(!e.target.checked),
        },
        {
          id: 'suppress_debugger_warning',
          title: 'Hide Debugger Warning',
          icon: Warning,
          description: 'Never show the warning dialog about the Chrome Debugger API',
          type: 'toggle',
          getValue: () => ctx.suppressDebugger,
          onChange: (e) => {
            const val = e.target.checked;
            ctx.setSuppressDebugger(val);
            localStorage.setItem('suppressDebuggerWarning', val.toString());
          },
        },
      ],
    },
    {
      id: 'fun',
      title: 'Fun',
      settings: [
        {
          id: 'crt_effect',
          title: 'Monitor Display Effect',
          icon: Television,
          description: 'Scanlines, phosphor glow, and sweep line on the tab preview',
          type: 'toggle',
          getValue: () => ctx.crtEnabled,
          onChange: () => ctx.toggleCRT(),
        },
        // {
        //   id: 'music',
        //   title: 'Music',
        //   icon: MusicNoteSimpleIcon,
        //   description: 'Play a little song while triaging',
        //   type: 'toggle',
        //   getValue: () => ctx.musicEnabled,
        //   onChange: () => ctx.toggleMusic(),
        // },
        // {
        //   id: 'music_dev',
        //   title: 'Music Dev Studio',
        //   icon: MusicNoteSimpleIcon,
        //   description: 'Developer piano roll for sequencing music.',
        //   type: 'button',
        //   onClick: () => ctx.handleNavigate('musicdev'),
        // },
      ],
    },
  ];
}

export default function SettingsCard({ handleNavigate }) {
  const { mode, setMode, excludeSuspendedTabs, setExcludeSuspendedTabs } = useTabProcessing();
  const hasSuspendedTabs = useHasSuspendedTabs();
  const {
    state: { isDisabled: isTutorialDisabled },
    actions: { setDisabled: setTutorialDisabled }
  } = useTutorial();
  const { theme, toggleTheme, reduceMotion, toggleReduceMotion } = useTheme();
  const { crtEnabled, toggleCRT } = useCRTEffect();
  const { musicEnabled, toggleMusic } = useMusic();
  const [suppressDebugger, setSuppressDebugger] = useState(() => localStorage.getItem('suppressDebuggerWarning') === 'true');
  const [suspenderExtensionId, setSuspenderExtensionId] = useState(() => localStorage.getItem('suspenderExtensionId') || 'bbomjaikkcabgmfaomdichgcodnaeecf');

  const [aiState, setAiState] = useState({
    isSupported: false,
    isDownloaded: false,
    isOptedIn: false,
  });
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => {
    isAiAvailable().then(res => {
      const isOptedIn = localStorage.getItem('ai_opt_in') === 'true';
      setAiState({
        isSupported: res.available || res.downloading || res.downloadable,
        isDownloaded: res.available,
        isOptedIn,
      });
    });
  }, []);

  const revokeAiAccess = () => {
    localStorage.removeItem('ai_opt_in');
    setAiState(prev => ({ ...prev, isOptedIn: false }));
  };

  const handleAiModalConfirm = () => {
    localStorage.setItem('ai_opt_in', 'true');
    if (!aiState.isDownloaded) {
      localStorage.setItem('ai_download_requested', 'true');
    }
    setAiState(prev => ({ ...prev, isOptedIn: true }));
    setShowAiModal(false);
  };

  // build config each render so getValue/onChange closures
  // always reference current state values
  const sections = buildSettingsSections({
    mode, setMode,
    excludeSuspendedTabs, setExcludeSuspendedTabs,
    hasSuspendedTabs,
    isTutorialDisabled, setTutorialDisabled,
    theme, toggleTheme,
    reduceMotion, toggleReduceMotion,
    crtEnabled, toggleCRT,
    musicEnabled, toggleMusic,
    suppressDebugger, setSuppressDebugger,
    suspenderExtensionId, setSuspenderExtensionId,
    handleNavigate,
  });

  const renderSettingRow = (setting) => {
    if (setting.condition && !setting.condition()) return null;

    return (
      <div key={setting.id} className={styles.settingRow}>
        <div className={styles.settingInfo}>
          <div className={styles.settingTitle}>
            {setting.icon && <setting.icon size={16} weight="duotone" className={styles.settingIcon} />}
            {setting.title}
          </div>
          {setting.description && (
            <div className={styles.settingDesc}>{setting.description}</div>
          )}
        </div>
        <div className={styles.settingControl}>
          {setting.type === 'select' && (
            <Select
              className={styles.select}
              value={setting.getValue()}
              onChange={setting.onChange}
              options={setting.options}
            />
          )}
          {setting.type === 'toggle' && (
            <input
              type="checkbox"
              className={styles.toggle}
              checked={setting.getValue()}
              onChange={setting.onChange}
            />
          )}
          {setting.type === 'text_input' && (
            <input
              type="text"
              className={styles.textInput}
              value={setting.getValue()}
              onChange={setting.onChange}
            />
          )}
          {setting.id === 'ai_model_management' && (
            <div className={styles.aiSettingControl}>
              {!aiState.isSupported ? (
                <div className={`${styles.badge} ${styles.badgeInactive}`}>Unsupported</div>
              ) : (
                <>
                  <button
                    className={`${styles.badge} ${aiState.isOptedIn ? '' : styles.badgeInactive}`}
                    style={{ cursor: 'pointer', border: '1px solid var(--color-border)', fontFamily: 'inherit', fontSize: 'inherit' }}
                    onClick={() => {
                      if (aiState.isOptedIn) {
                        revokeAiAccess();
                      } else {
                        setShowAiModal(true);
                      }
                    }}
                    title={aiState.isOptedIn ? "Click to revoke consent" : "Click to grant consent"}
                  >
                    {aiState.isOptedIn ? <><CheckCircle size={14} weight="fill" /> Active</> : 'Inactive'}
                  </button>

                  <button
                    className={`${styles.badge} ${aiState.isDownloaded ? '' : styles.badgeInactive}`}
                    style={{
                      cursor: aiState.isDownloaded ? 'default' : 'pointer',
                      border: '1px solid var(--color-border)',
                      backgroundColor: aiState.isDownloaded ? 'var(--color-surface)' : undefined,
                      color: aiState.isDownloaded ? 'var(--color-text-secondary)' : undefined,
                      fontFamily: 'inherit',
                      fontSize: 'inherit'
                    }}
                    onClick={() => {
                      if (!aiState.isDownloaded) {
                        setShowAiModal(true);
                      }
                    }}
                    title={!aiState.isDownloaded ? "Click to request download" : "Model is downloaded"}
                  >
                    {aiState.isDownloaded ? 'Downloaded' : 'Download (1.5GB)'}
                  </button>
                </>
              )}
            </div>
          )}
          {setting.type === 'button' && (
            <button className={styles.button} onClick={setting.onClick}>
              Open
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.settingsCard}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Gear size={16} weight="duotone" />
          Settings
        </span>
      </div>

      <div className={styles.content}>
        {sections.map(section => (
          <div key={section.id} className={styles.section}>
            <h3 className={styles.sectionTitle}>{section.title}</h3>
            <div className={styles.sectionBody}>
              {section.settings.map(renderSettingRow)}
            </div>
          </div>
        ))}
      </div>

      {showAiModal && (
        <AiOptInModal
          isAlreadyDownloaded={aiState.isDownloaded}
          onConfirm={handleAiModalConfirm}
          onCancel={() => setShowAiModal(false)}
        />
      )}
    </div>
  );
}
