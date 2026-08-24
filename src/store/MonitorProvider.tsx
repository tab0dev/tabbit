import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';

export interface MonitorMessage {
  id: string;
  text: string;
  icon: string | null;
  level: string;
  createdAt: number;
  ttlMs: number;
}

export interface MonitorContextValue {
  mode: 'hotkeys' | 'monitor';
  setMode: (mode: 'hotkeys' | 'monitor') => void;
  toggleMode: () => void;
  messages: MonitorMessage[];
  activeMessage: MonitorMessage | null;
  postStatus: (text: string, options?: { ttlMs?: number; icon?: string; level?: string }) => void;
}

const MonitorContext = createContext<MonitorContextValue | null>(null);

const MODE_KEY = 'tabZeroBottomBarMode';
const DEFAULT_MODE = 'hotkeys';
const DEFAULT_TTL_MS = 3200;
const MAX_HISTORY = 24;

export function MonitorProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<'hotkeys' | 'monitor'>(
    DEFAULT_MODE as 'hotkeys' | 'monitor',
  );
  const [messages, setMessages] = useState<MonitorMessage[]>([]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'hotkeys' || saved === 'monitor') {
        setModeState(saved);
      }
    } catch (err) {
      console.error('Failed to load monitor mode:', err);
    }
  }, []);

  const setMode = useCallback((nextMode: 'hotkeys' | 'monitor') => {
    if (nextMode !== 'hotkeys' && nextMode !== 'monitor') return;
    setModeState(nextMode);
    try {
      localStorage.setItem(MODE_KEY, nextMode);
    } catch (err) {
      console.error('Failed to save monitor mode:', err);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'hotkeys' ? 'monitor' : 'hotkeys');
  }, [mode, setMode]);

  const postStatus = useCallback(
    (text: string, options: { ttlMs?: number; icon?: string; level?: string } = {}) => {
      if (!text || typeof text !== 'string') return;
      const ttlMs =
        typeof options.ttlMs === 'number' && Number.isFinite(options.ttlMs)
          ? Math.max(700, options.ttlMs)
          : DEFAULT_TTL_MS;

      const message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text,
        icon: typeof options.icon === 'string' ? options.icon : null,
        level: options.level || 'info',
        createdAt: Date.now(),
        ttlMs,
      };

      setMessages((prev) => {
        const next = [...prev, message];
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      });
      setActiveMessageId(message.id);

      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = setTimeout(() => {
        setActiveMessageId((currentId) => (currentId === message.id ? null : currentId));
      }, ttlMs);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const activeMessage = useMemo(
    () => messages.find((message) => message.id === activeMessageId) || null,
    [messages, activeMessageId],
  );

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode,
      messages,
      activeMessage,
      postStatus,
    }),
    [mode, setMode, toggleMode, messages, activeMessage, postStatus],
  );

  return <MonitorContext.Provider value={value}>{children}</MonitorContext.Provider>;
}

export function useMonitor(): MonitorContextValue {
  const context = useContext(MonitorContext);
  if (!context) {
    throw new Error('useMonitor must be used within a MonitorProvider');
  }
  return context;
}
