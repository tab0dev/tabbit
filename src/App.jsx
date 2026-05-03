import React, { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { TriageProvider, useTriage, Mode } from './store/TriageProvider';
import TriageDashboard from './components/Dashboard/TriageDashboard';
import PermissionBanner from './components/Dashboard/PermissionBanner';
import { useChromeApis } from './hooks/useChromeApis';
import { useKeyboard } from './hooks/useKeyboard';
import { HotkeysProvider } from './store/HotkeysProvider';
import { MonitorProvider } from './store/MonitorProvider';
import { useProgress } from './hooks/useProgress';
import { TabProcessingProvider, useTabProcessing } from './store/TabProcessingProvider';
import { ThemeProvider } from './store/ThemeProvider';
import { CRTEffectProvider } from './store/CRTEffectProvider';
import { MusicProvider } from './store/MusicProvider';
import { TimerProvider } from './store/TimerProvider';
import { PickerProvider } from './store/PickerProvider';

const CONFETTI_COLORS = ['#39ae64', '#1a1d27', '#f87171', '#3b82f6', '#f59e0b'];

function GlobalConfetti() {
  const { state } = useTriage();
  const isComplete = state.mode === Mode.COMPLETE;
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  if (!isComplete) return null;

  return (
    <Confetti
      width={windowSize.width}
      height={windowSize.height}
      numberOfPieces={200}
      recycle={false}
      colors={CONFETTI_COLORS}
      style={{ zIndex: 9999 }}
    />
  );
}

function AppWrapper({ children }) {
  const { excludeSuspendedTabs } = useTabProcessing();
  const tabFilterFn = excludeSuspendedTabs ? (tab) => !tab.isSuspended : null;
  const { progressPercent } = useProgress(tabFilterFn);

  return (
    <div
      className="app-root"
      style={{
        backgroundColor: `color-mix(in srgb, var(--bg-surface) ${progressPercent}%, var(--bg))`
      }}
    >
      {children}
    </div>
  );
}

function AppContent() {
  const { state } = useTriage();
  useChromeApis();
  useKeyboard();

  switch (state.mode) {
    case Mode.LOADING:
      return (
        <div className="view">
          <div className="loading-spinner" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 800ms linear infinite' }}></div>
          <p style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: 14 }}>Gathering tabs…</p>
        </div>
      );
    case Mode.PERMISSION:
      return <PermissionBanner />;
    case Mode.TRIAGING:
    case Mode.PICKER:
    case Mode.COMPLETE:
      return (
        <TriageDashboard />
      );
    default:
      return null;
  }
}

function App() {
  return (
    <ThemeProvider>
      <CRTEffectProvider>
        <MusicProvider>
          <MonitorProvider>
            <TabProcessingProvider>
              <TriageProvider>
                <HotkeysProvider>
                  <TimerProvider>
                    <PickerProvider>
                      <AppWrapper>
                        <GlobalConfetti />
                        <AppContent />
                      </AppWrapper>
                    </PickerProvider>
                  </TimerProvider>
                </HotkeysProvider>
              </TriageProvider>
            </TabProcessingProvider>
          </MonitorProvider>
        </MusicProvider>
      </CRTEffectProvider>
    </ThemeProvider>
  )
}

export default App
