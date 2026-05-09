import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './MusicDevTrackerCard.module.css';

import { Play, Stop, DownloadSimple } from '@phosphor-icons/react';
import * as Tone from 'tone';
import { song1 } from '../../../data/songs/song1';

const STEPS = 32;

const LAYER_PITCHES = {
  kick: ['C4'],
  hihat: ['C4'],
  snare: ['C4'],
  bass: ['C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2', 'G2', 'F2', 'E2', 'D2', 'C2'],
  melody: ['C6', 'B5', 'A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'],
  lead: ['E6', 'D6', 'C6', 'B5', 'A5', 'G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4'],
  vocal: ['C4', 'B3', 'A3', 'G3', 'F3', 'E3'],
  piano: ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3'],
};

const stepToTime = (step) => {
  const bar = Math.floor(step / 16);
  const quarter = Math.floor((step % 16) / 4);
  const sixteenth = step % 4;
  return `${bar}:${quarter}:${sixteenth}`;
};

const timeToStep = (timeStr) => {
  const [b, q, s] = timeStr.split(':').map(Number);
  return (b * 16) + (q * 4) + s;
};

export default function MusicDevTrackerCard({ onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const engineRef = useRef(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState(null);
  
  const [localSong, setLocalSong] = useState(() => JSON.parse(JSON.stringify(song1)));
  const localSongRef = useRef(localSong);

  useEffect(() => {
    localSongRef.current = localSong;
  }, [localSong]);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.loop?.dispose();
        engineRef.current.players.forEach(p => p?.dispose());
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
      localSong.layers.map((l) =>
        new Promise((resolve) => {
          const player = new Tone.Sampler({
            urls: l.urls,
            baseUrl: l.baseUrl || "",
            onload: () => resolve(player),
            onerror: () => resolve(null),
          }).toDestination();
          player.volume.value = l.volume;
        })
      )
    );

    const loop = new Tone.Loop((time) => {
      const ticks = Tone.getTransport().ticks;
      const ticksPer16th = Tone.Time('16n').toTicks();
      const step = Math.floor(ticks / ticksPer16th) % STEPS;
      
      Tone.Draw.schedule(() => {
        setCurrentStep(step);
      }, time);
      
      // Use latest song state
      localSongRef.current.layers.forEach((l, i) => {
        const player = players[i];
        if (!player) return;
        const notesAtStep = l.pattern.filter(n => timeToStep(n.time) === step);
        notesAtStep.forEach(n => {
          player.triggerAttackRelease(n.note, n.duration || "8n", time);
        });
      });
    }, "16n").start(0);

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

  const applyNoteChange = useCallback((layerId, pitch, step, makeActive) => {
    setLocalSong(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetLayer = next.layers.find(l => l.id === layerId);
      const timeStr = stepToTime(step);
      const existingIdx = targetLayer.pattern.findIndex(n => n.time === timeStr && n.note === pitch);
      
      if (makeActive && existingIdx === -1) {
        targetLayer.pattern.push({ time: timeStr, note: pitch, duration: "8n" });
      } else if (!makeActive && existingIdx !== -1) {
        targetLayer.pattern.splice(existingIdx, 1);
      }
      return next;
    });
  }, []);

  const handlePointerDown = (e, layerId, pitch, step, currentlyActive) => {
    e.preventDefault();
    setIsDragging(true);
    const action = currentlyActive ? 'remove' : 'add';
    setDragAction(action);
    applyNoteChange(layerId, pitch, step, action === 'add');
  };

  const handlePointerEnter = (e, layerId, pitch, step, currentlyActive) => {
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
    alert("Song data copied to clipboard! Paste it into song1.js");
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>Music Dev Studio</span>
        <button className={styles.closeBtn} onClick={onClose}>Close</button>
      </div>
      
      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={togglePlayback}>
          {isPlaying ? <Stop size={20} /> : <Play size={20} />}
        </button>
        <button className={styles.btn} onClick={exportSong} title="Export to clipboard">
          <DownloadSimple size={20} />
        </button>
      </div>

      <div className={styles.sequencer} onPointerLeave={() => { setIsDragging(false); setDragAction(null); }}>
        {localSong.layers.map(layer => {
          const pitches = LAYER_PITCHES[layer.id] || ['C4'];
          return (
            <div key={layer.id} className={styles.layerGroup}>
              <h3 className={styles.layerTitle}>{layer.label}</h3>
              <div className={styles.grid}>
                {pitches.map(pitch => (
                  <div key={pitch} className={styles.row}>
                    <div className={styles.rowLabel}>{pitch}</div>
                    <div className={styles.steps}>
                      {Array.from({ length: STEPS }).map((_, step) => {
                        const isActive = layer.pattern.some(n => n.note === pitch && timeToStep(n.time) === step);
                        const isCurrent = step === currentStep;
                        return (
                          <div 
                            key={step} 
                            className={`${styles.step} ${isActive ? styles.activeStep : ''} ${isCurrent ? styles.currentStep : ''} ${(step % 4 === 0) ? styles.beatMarker : ''}`}
                            onPointerDown={(e) => handlePointerDown(e, layer.id, pitch, step, isActive)}
                            onPointerEnter={(e) => handlePointerEnter(e, layer.id, pitch, step, isActive)}
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
