import { useState, useRef, useCallback, useEffect } from 'react';
import { MUSIC_CONFIG } from '../data/musicConfig';

export const BUNNY_LEFT = 10;
export const BUNNY_W    = 16;
export const BUNNY_H    = 18;

const INVINCIBILITY_MS = 600;

const DEFAULT_CFG = {
  jumpVelocity:      7,
  gravity:           0.45,
  beatsToArrive:     3,
  obstacleWidth:     10,
  obstacleHeightMin: 8,
  obstacleHeightMax: 14,
  groundHeight:      4,
  collisionSlop:     3,
};

/**
 * useMusicGame — V2
 *
 * ─── CORE CHANGE FROM V1 ─────────────────────────────────────────────────────
 * One obstacle per BAR (spawned on barFlash) instead of one per BEAT (beatFlash).
 * With beatsToArrive=3, an obstacle spawned on beat 1 of bar N arrives at the
 * bunny on beat 4 of bar N — exactly on the snare. The music itself is the jump cue.
 *
 * ─── SIGNAL ROLES ───────────────────────────────────────────────────────────────
 *  actionFlash  — every triage keypress → jump (unconditional)
 *  hitFlash     — on-beat action → clear nearest uncleared obstacle + streak++
 *  missFlash    — bar ended with no on-beat action → red flash + streak reset
 *  layerDownFlash — layer dropped → long red flash
 *  barFlash     — beat 1 of new bar → spawn one obstacle
 *  beatFlash    — unused for spawning now (still drives beat ring glow in JSX)
 */
export function useMusicGame({
  barFlash,
  actionFlash,
  hitFlash,
  missFlash,
  layerDownFlash,
  musicEnabled,
  beatIntervalMs,
  trackRef,
}) {
  const cfg = useRef({ ...DEFAULT_CFG, ...(MUSIC_CONFIG.game ?? {}) }).current;

  // ── React state ──────────────────────────────────────────────────────────────
  const [obstacles,      setObstacles]      = useState([]);
  const [bunnyY,         setBunnyY]         = useState(0);
  const [isJumping,      setIsJumping]      = useState(false);
  const [streak,         setStreak]         = useState(0);
  const [bunnyMood,      setBunnyMood]      = useState('idle');
  const [bunnyAnimation, setBunnyAnimation] = useState('none');
  const [colliding,      setColliding]      = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const obstaclesRef       = useRef([]);
  const bunnyYRef          = useRef(0);
  const velYRef            = useRef(0);
  const isJumpingRef       = useRef(false);
  const streakRef          = useRef(0);
  const rafRef             = useRef(null);
  const lastTimeRef        = useRef(null);
  const invincibleUntilRef = useRef(0);
  const obsIdRef           = useRef(0); // simple monotonic ID

  const beatIntervalMsRef  = useRef(beatIntervalMs);
  const musicEnabledRef    = useRef(musicEnabled);
  useEffect(() => { beatIntervalMsRef.current = beatIntervalMs; }, [beatIntervalMs]);
  useEffect(() => { musicEnabledRef.current   = musicEnabled;   }, [musicEnabled]);

  // ── Reset on music off ───────────────────────────────────────────────────────
  useEffect(() => {
    if (musicEnabled) return;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    lastTimeRef.current        = null;
    obstaclesRef.current       = [];
    bunnyYRef.current          = 0;
    velYRef.current            = 0;
    isJumpingRef.current       = false;
    streakRef.current          = 0;
    invincibleUntilRef.current = 0;
    obsIdRef.current           = 0;
    setObstacles([]);
    setBunnyY(0);
    setIsJumping(false);
    setStreak(0);
    setBunnyMood('idle');
    setBunnyAnimation('none');
    setColliding(false);
  }, [musicEnabled]);

  // ── barFlash → spawn ONE obstacle per bar ────────────────────────────────────
  // one decision moment per bar. with beatsToArrive=3, the obstacle travels 3
  // quarter-note durations before it reaches BUNNY_LEFT — landing on beat 4.
  const prevBarFlash = useRef(false);
  useEffect(() => {
    if (!musicEnabled) return;
    if (barFlash === prevBarFlash.current) return;
    prevBarFlash.current = barFlash;
    if (!barFlash) return;

    const trackWidth = trackRef?.current?.offsetWidth ?? 220;
    const h = Math.round(
      cfg.obstacleHeightMin +
      Math.random() * (cfg.obstacleHeightMax - cfg.obstacleHeightMin)
    );
    const id = `obs-${++obsIdRef.current}`;
    obstaclesRef.current = [
      ...obstaclesRef.current,
      {
        id,
        x:       trackWidth,
        width:   cfg.obstacleWidth,
        height:  h,
        cleared: false,
        passed:  false,
      },
    ];
  }, [barFlash, musicEnabled, trackRef, cfg]);

  // ── Jump ──────────────────────────────────────────────────────────────────
  const jump = useCallback(() => {
    if (isJumpingRef.current || !musicEnabledRef.current) return;
    isJumpingRef.current = true;
    velYRef.current      = cfg.jumpVelocity;
    setIsJumping(true);
    setBunnyMood('happy');
  }, [cfg.jumpVelocity]);

  // ── actionFlash → jump (every keypress, unconditional) ───────────────────────
  const prevActionFlash = useRef(false);
  useEffect(() => {
    if (actionFlash && !prevActionFlash.current) jump();
    prevActionFlash.current = actionFlash;
  }, [actionFlash, jump]);

  // ── hitFlash → clear nearest obstacle + streak++ ─────────────────────────────
  const prevHitFlash = useRef(false);
  useEffect(() => {
    if (hitFlash && !prevHitFlash.current) {
      // Clear the nearest uncleared obstacle
      const nearest = obstaclesRef.current
        .filter(o => !o.cleared && !o.passed)
        .sort((a, b) => a.x - b.x)[0] ?? null;

      if (nearest) {
        const updated = obstaclesRef.current.map(o =>
          o.id === nearest.id ? { ...o, cleared: true } : o
        );
        obstaclesRef.current = updated;
        setObstacles([...updated]);
      }

      // Increment streak
      streakRef.current += 1;
      setStreak(streakRef.current);
      setBunnyAnimation('pulse');
      setTimeout(() => setBunnyAnimation('none'), 350);
    }
    prevHitFlash.current = hitFlash;
  }, [hitFlash]);

  // ── missFlash → red flash + streak reset ─────────────────────────────────────
  const prevMissFlash = useRef(false);
  useEffect(() => {
    if (missFlash && !prevMissFlash.current) {
      // Reset streak on miss
      streakRef.current = 0;
      setStreak(0);
      setBunnyAnimation('shake');
      setBunnyMood('sad');
      setColliding(true);
      setTimeout(() => { setBunnyAnimation('none'); setBunnyMood('idle'); }, 500);
      setTimeout(() => setColliding(false), 350);
    }
    prevMissFlash.current = missFlash;
  }, [missFlash]);

  // ── layerDownFlash → longer red flash ───────────────────────────────────────
  const prevLayerDown = useRef(false);
  useEffect(() => {
    if (layerDownFlash && !prevLayerDown.current) {
      setBunnyMood('sad');
      setColliding(true);
      setTimeout(() => { setBunnyMood('idle'); setColliding(false); }, 600);
    }
    prevLayerDown.current = layerDownFlash;
  }, [layerDownFlash]);

  // ── rAF game loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!musicEnabled) return;

    const loop = (time) => {
      const dt = lastTimeRef.current
        ? Math.min(time - lastTimeRef.current, 50)
        : 16.67;
      lastTimeRef.current = time;

      const trackW = trackRef?.current?.offsetWidth ?? 220;
      const bims   = beatIntervalMsRef.current ?? 833;

      // Speed: obstacle travels from right edge to BUNNY_LEFT in beatsToArrive beats
      const arrivalMs = bims * cfg.beatsToArrive;
      const speed     = (trackW - BUNNY_LEFT) / arrivalMs;
      const dx        = speed * dt;

      // Scroll, mark passed, prune off-screen
      let obs = obstaclesRef.current
        .map(o => {
          const nx        = o.x - dx;
          const justPassed = !o.passed && (nx + o.width) < BUNNY_LEFT;
          return { ...o, x: nx, passed: o.passed || justPassed };
        })
        .filter(o => o.x > -(o.width + 20));

      // ── Collision (uncleared obstacles only) ──────────────────────────────
      const now        = performance.now();
      const invincible = now < invincibleUntilRef.current;
      let   collided   = false;

      if (!invincible) {
        obs.forEach(o => {
          if (o.cleared || o.passed) return;
          const overlapX =
            (BUNNY_LEFT + BUNNY_W) > (o.x - cfg.collisionSlop) &&
            BUNNY_LEFT             < (o.x + o.width + cfg.collisionSlop);
          const bunnyClears = bunnyYRef.current >= (o.height - cfg.collisionSlop);
          if (overlapX && !bunnyClears) collided = true;
        });
      }

      if (collided) {
        invincibleUntilRef.current = performance.now() + INVINCIBILITY_MS;
        // Streak reset on collision too
        streakRef.current = 0;
        setStreak(0);
        setColliding(true);
        setBunnyMood('sad');
        setBunnyAnimation('shake');
        setTimeout(() => setColliding(false), 300);
        setTimeout(() => { setBunnyMood('idle'); setBunnyAnimation('none'); }, 600);
      }

      obstaclesRef.current = obs;
      setObstacles([...obs]);

      // ── Jump physics ──────────────────────────────────────────────────────
      if (isJumpingRef.current) {
        const f = dt / 16.67;
        bunnyYRef.current += velYRef.current * f;
        velYRef.current   -= cfg.gravity * f;

        if (bunnyYRef.current <= 0) {
          bunnyYRef.current    = 0;
          velYRef.current      = 0;
          isJumpingRef.current = false;
          setIsJumping(false);
          if (!collided) { setBunnyMood('idle'); setBunnyAnimation('none'); }
        }
      }

      setBunnyY(bunnyYRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      lastTimeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicEnabled]);

  return { obstacles, bunnyY, isJumping, streak, bunnyMood, bunnyAnimation, colliding, jump };
}
