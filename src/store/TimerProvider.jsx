import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

const TimerContext = createContext();

export function TimerProvider({ children }) {
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const pauseOffsetRef = useRef(0);
  const pauseStartRef = useRef(null);

  useEffect(() => {
    if (isPaused) {
      if (!pauseStartRef.current) {
        pauseStartRef.current = Date.now();
      }
      return;
    }

    if (pauseStartRef.current) {
      pauseOffsetRef.current += (Date.now() - pauseStartRef.current);
      pauseStartRef.current = null;
    }

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current - pauseOffsetRef.current) / 1000));
    }, 1000);
    
    setElapsed(Math.floor((Date.now() - startTimeRef.current - pauseOffsetRef.current) / 1000));

    return () => clearInterval(interval);
  }, [isPaused]);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);
  const reset = useCallback(() => {
    startTimeRef.current = Date.now();
    pauseOffsetRef.current = 0;
    pauseStartRef.current = null;
    setElapsed(0);
    setIsPaused(false);
  }, []);

  const value = useMemo(() => ({
    elapsed, isPaused, pause, resume, reset
  }), [elapsed, isPaused, pause, resume, reset]);

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}
