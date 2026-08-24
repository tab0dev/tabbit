import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './MusicDevTrackerCard.module.css';

import { Play, Stop, DownloadSimple } from '@phosphor-icons/react';
import * as Tone from 'tone';
import { song1 } from '../../../store/music/songs/song1';

const STEPS = 32;

const LAYER_PITCHES = {
  kick: ['C4'],
  hihat: ['C4'],
  snare: ['C4'],
  bass: ['C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2', 'G2', 'F2', 'E2', 'D2', 'C2'],
  melody: [
    'C6',
    'B5',
    'A5',
    'G5',
    'F5',
    'E5',
    'D5',
    'C5',
    'B4',
    'A4',
    'G4',
    'F4',
    'E4',
    'D4',
    'C4',
  ],
  lead: ['E6', 'D6', 'C6', 'B5', 'A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4'],
  vocal: ['C4', 'B3', 'A3', 'G3', 'F3', 'E3'],
  piano: ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3'],
};

export interface MusicNote {
  time: string;
  note: string;
  duration?: string;
}

export interface MusicLayer {
  id: string;
  type: string;
  sample?: string;
  synth?: string;
  urls?: Record<string, string>;
  baseUrl?: string;
  pattern: MusicNote[];
  volume: number;
}

export interface MusicSong {
  bpm: number;
  layers: MusicLayer[];
}

const stepToTime = (step: number) => {
  const bar = Math.floor(step / 16);
  const quarter = Math.floor((step % 16) / 4);
  const sixteenth = step % 4;
  return `${bar}:${quarter}:${sixteenth}`;
};

const timeToStep = (timeStr: string) => {
  const [b, q, s] = timeStr.split(':').map(Number);
  return b * 16 + q * 4 + s;
};

export interface MusicDevTrackerCardProps {
  onClose: () => void;
}
interface MusicEngineInstance {
  loop?: { dispose: () => void };
  players?: (Tone.Sampler | null)[];
}

export default function MusicDevTrackerCard({ onClose }: MusicDevTrackerCardProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const engineRef = useRef<MusicEngineInstance | null>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragAction, setDragAction] = useState<'add' | 'remove' | null>(null);

  const [localSong, setLocalSong] = useState<MusicSong>(() => JSON.parse(JSON.stringify(song1)));
  const localSongRef = useRef(localSong);

  useEffect(() => {
    localSongRef.current = localSong;
  }, [localSong]);

  useEffect(() => {
    return () => {
      const engine = engineRef.current as MusicEngineInstance | null;
      if (engine) {
        engine.loop?.dispose();
        engine.players?.forEach((p) => p?.dispose());
        Tone.getTransport().stop();
      }
    };
  }, []);

  const initEngine = async () => {
    if (engineRef.current) return;
    await Tone.start();

    Tone.getTransport().bpm.value = localSong.bpm;
    Tone.getTransport().timeSignature = [4, 4];

    const players = await Promise.all(
      localSong.layers.map(
        (l: MusicLayer) =>
          new Promise<Tone.Sampler | null>((resolve) => {
            const player = new Tone.Sampler({
              urls: l.urls,
              baseUrl: l.baseUrl || '',
              onload: () => resolve(player),
              onerror: () => resolve(null),
            }).toDestination();
            player.volume.value = l.volume;
          }),
      ),
    );

    const loop = new Tone.Loop((time) => {
      const ticks = Tone.getTransport().ticks;
      const ticksPer16th = Tone.Time('16n').toTicks();
      const step = Math.floor(ticks / ticksPer16th) % STEPS;

      Tone.Draw.schedule(() => {
        setCurrentStep(step);
      }, time);

      // Use latest song state
      localSongRef.current.layers.forEach((l: MusicLayer, i: number) => {
        const player = players[i] as {
          triggerAttackRelease?: (note: string, dur: string, time: number) => void;
        } | null;
        if (!player) return;
        const notesAtStep = l.pattern.filter((n: MusicNote) => timeToStep(n.time) === step);
        notesAtStep.forEach((n: MusicNote) => {
          player.triggerAttackRelease?.(n.note, n.duration || '8n', time);
        });
      });
    }, '16n').start(0);

    engineRef.current = { players, loop };
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      Tone.getTransport().pause();
      Tone.getTransport().position = 0;
      setCurrentStep(-1);
      setIsPlaying(false);
    } else {
      await initEngine();
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  };

  const applyNoteChange = useCallback(
    (layerId: string, pitch: string, step: number, makeActive: boolean) => {
      setLocalSong((prev: MusicSong) => {
        const next = {
          ...prev,
          layers: prev.layers.map((l) => ({ ...l, pattern: [...l.pattern] })),
        };
        const targetLayer = next.layers.find((l: MusicLayer) => l.id === layerId);
        if (!targetLayer) return prev;

        const timeStr = stepToTime(step);
        const existingIdx = targetLayer.pattern.findIndex(
          (n: MusicNote) => n.time === timeStr && n.note === pitch,
        );

        if (makeActive && existingIdx === -1) {
          targetLayer.pattern.push({ time: timeStr, note: pitch, duration: '8n' });
        } else if (!makeActive && existingIdx !== -1) {
          targetLayer.pattern.splice(existingIdx, 1);
        }
        return next;
      });
    },
    [],
  );

  const handlePointerDown = (
    e: React.PointerEvent,
    layerId: string,
    pitch: string,
    step: number,
    currentlyActive: boolean,
  ) => {
    e.preventDefault();
    setIsDragging(true);
    const action = currentlyActive ? 'remove' : 'add';
    setDragAction(action);
    applyNoteChange(layerId, pitch, step, action === 'add');
  };

  const handlePointerEnter = (
    e: React.PointerEvent,
    layerId: string,
    pitch: string,
    step: number,
    currentlyActive: boolean,
  ) => {
    e.preventDefault();
    if (!isDragging) return;
    if (dragAction === 'add' && !currentlyActive) {
      applyNoteChange(layerId, pitch, step, true);
    } else if (dragAction === 'remove' && currentlyActive) {
      applyNoteChange(layerId, pitch, step, false);
    }
  };

  useEffect(() => {
    const handlePointerUp = () => {
      setIsDragging(false);
      setDragAction(null);
    };
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, []);

  const exportSong = () => {
    const json = JSON.stringify(localSong, null, 2);
    navigator.clipboard.writeText(`export const song1 = ${json};`);
    alert('Song data copied to clipboard! Paste it into song1.js');
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>Music Dev Studio</span>
        <button className={styles.closeBtn} onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={togglePlayback}>
          {isPlaying ? <Stop size={20} /> : <Play size={20} />}
        </button>
        <button className={styles.btn} onClick={exportSong} title="Export to clipboard">
          <DownloadSimple size={20} />
        </button>
      </div>

      <div
        className={styles.sequencer}
        onPointerLeave={() => {
          setIsDragging(false);
          setDragAction(null);
        }}
      >
        {localSong.layers.map((layer: MusicLayer) => {
          const pitches = LAYER_PITCHES[layer.type as keyof typeof LAYER_PITCHES] || ['C4'];
          const isDrum =
            layer.type !== 'bass' &&
            layer.type !== 'melody' &&
            layer.type !== 'lead' &&
            layer.type !== 'piano' &&
            layer.type !== 'vocal';

          return (
            <div key={layer.id} className={styles.layerRow}>
              <div className={styles.layerHeader}>
                {layer.id} <span style={{ opacity: 0.5, fontSize: '10px' }}>({layer.type})</span>
              </div>
              <div className={styles.pitchGrid}>
                {pitches.map((pitch: string) => (
                  <div key={pitch} className={styles.pitchRow}>
                    {!isDrum && <div className={styles.pitchLabel}>{pitch}</div>}
                    <div className={styles.stepsContainer}>
                      {Array.from({ length: STEPS }).map((_, step) => {
                        const isActive = layer.pattern.some(
                          (n: MusicNote) => n.note === pitch && timeToStep(n.time) === step,
                        );
                        const isCurrent = step === currentStep;
                        return (
                          <div
                            key={step}
                            className={`${styles.step} ${isActive ? styles.activeStep : ''} ${isCurrent ? styles.currentStep : ''} ${step % 4 === 0 ? styles.beatMarker : ''}`}
                            onPointerDown={(e) =>
                              handlePointerDown(e, layer.id, pitch, step, isActive)
                            }
                            onPointerEnter={(e) =>
                              handlePointerEnter(e, layer.id, pitch, step, isActive)
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
