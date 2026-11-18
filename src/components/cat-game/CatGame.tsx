"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { AUDIO, BADGES_EVENT, METER, type CatId } from "./config";
import { useCatGame, type GameEvent } from "./useCatGame";
import "./cat-game.css";

const MAX_FLOATERS = 8;
const FLOAT_MS = 800;
const MESSAGE_MS = 4000;
const PURR_VOLUME = 0.35;
const MEOW_VOLUME = 0.8;

type Floater = { id: number; catId: CatId; dx: number };

export default function CatGame({ onClose }: { onClose?: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { dialogRef.current?.focus({ preventScroll: true }); }, []);

  /* ---- audio + badge message (driven by the hook's one-off events) ---- */
  const purrAudio = useRef<HTMLAudioElement | null>(null);
  const meowAudio = useRef<HTMLAudioElement | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const purrWanted = useRef(false); // the game wants the purr on, even if muted right now
  const mutedRef = useRef(true);
  const [message, setMessage] = useState<string | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFade = () => {
    if (fadeTimer.current) clearInterval(fadeTimer.current);
    fadeTimer.current = null;
  };
  const fadeTo = (a: HTMLAudioElement, target: number, ms: number, done?: () => void) => {
    clearFade();
    const from = a.volume;
    const t0 = performance.now();
    fadeTimer.current = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.min(1, Math.max(0, from + (target - from) * k));
      if (k >= 1) {
        clearFade();
        done?.();
      }
    }, 30);
  };
  const startPurr = () => {
    const a = purrAudio.current;
    if (!a || mutedRef.current) return;
    if (a.paused) {
      a.volume = 0;
      a.play().catch(() => {}); // blocked or missing file: stay silent
    }
    fadeTo(a, PURR_VOLUME, 400);
  };
  const stopPurr = (immediate = false) => {
    const a = purrAudio.current;
    if (!a) return;
    if (immediate || a.paused) {
      clearFade();
      a.pause();
      a.volume = 0;
    } else {
      fadeTo(a, 0, 600, () => a.pause());
    }
  };
  const playMeow = () => {
    const a = meowAudio.current;
    if (!a || mutedRef.current) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  };
  const showMessage = (text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), MESSAGE_MS);
  };
  const onEvent = (e: GameEvent) => {
    switch (e.type) {
      case "purrStart":
        purrWanted.current = true;
        startPurr();
        break;
      case "purrStop":
        purrWanted.current = false;
        stopPurr();
        break;
      case "badgeUnlocked":
      case "badgeAlreadyOwned":
        playMeow();
        showMessage(e.message);
        break;
    }
  };

  const { cats, pets, streak, best, meters, muted, badges, hydrated, happy, activeCatId, pet, startHold, stopHold, reset, toggleMute } =
    useCatGame({ onEvent });
  mutedRef.current = muted;

  /* tell the desk's badge row when badges change (it reads them from localStorage) */
  useEffect(() => {
    if (hydrated) window.dispatchEvent(new Event(BADGES_EVENT));
  }, [hydrated, badges]);

  const onReset = () => {
    reset();
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage(null);
  };

  useEffect(() => {
    const p = new Audio(AUDIO.purr);
    p.loop = true;
    p.preload = "auto";
    p.volume = 0;
    const m = new Audio(AUDIO.meow);
    m.preload = "auto";
    m.volume = MEOW_VOLUME;
    purrAudio.current = p;
    meowAudio.current = m;
    return () => {
      clearFade();
      p.pause();
      m.pause();
      purrAudio.current = null;
      meowAudio.current = null;
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* muting silences everything at once; unmuting mid-purr brings the purr back */
  useEffect(() => {
    if (muted) {
      stopPurr(true);
      meowAudio.current?.pause();
    } else if (purrWanted.current) {
      startPurr();
    }
  }, [muted]); // eslint-disable-line react-hooks/exhaustive-deps

  const ticks = [METER.checkpoints.bubble, METER.checkpoints.purr, METER.checkpoints.hearts];

  /* preload the happy faces so the swap never flashes */
  useEffect(() => {
    cats.forEach((c) => { new Image().src = c.happy; });
  }, [cats]);

  /* "+1" floaters: one per pet, on the cat being petted */
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const prevPets = useRef(0);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (pets > prevPets.current && activeCatId) {
      const id = nextId.current++;
      const dx = ((id * 37) % 61) - 30; // small deterministic sideways spread
      setFloaters((f) => [...f.slice(-(MAX_FLOATERS - 1)), { id, catId: activeCatId, dx }]);
      timers.current.push(setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), FLOAT_MS));
    }
    prevPets.current = pets;
  }, [pets, activeCatId]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* keyboard: Enter / Space pets (holding the key repeats) */
  const onKey = (e: KeyboardEvent, id: CatId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pet(id);
    }
  };

  return (
    <div className="cg-ov" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="cg-wrap">
        <div className="cg" role="dialog" aria-modal="true" aria-labelledby="cg-title" tabIndex={-1} ref={dialogRef}>
          <button className="cg-x" type="button" aria-label="Close" onClick={onClose}>×</button>
          <h2 id="cg-title">Pet the cats</h2>
          <p className="cg-sub">click a cat to pet it. keep going to fill the purr meter.</p>

          <div className="cg-cats">
            {cats.map((cat) => {
              const on = activeCatId === cat.id;
              return (
                <figure key={cat.id} className="cg-cat">
                  <button
                    type="button"
                    className={`cg-card${on ? " on" : ""}`}
                    aria-label={`Pet ${cat.name}`}
                    onPointerDown={(e) => { if (e.pointerType !== "mouse" || e.button === 0) startHold(cat.id); }}
                    onPointerUp={stopHold}
                    onPointerCancel={stopHold}
                    onPointerLeave={stopHold}
                    onBlur={stopHold}
                    onContextMenu={(e) => e.preventDefault()}
                    onKeyDown={(e) => onKey(e, cat.id)}
                  >
                    {on && meters[cat.id] >= METER.checkpoints.bubble && <span className="cg-bubble" aria-hidden="true">mrrp!</span>}
                    {on && meters[cat.id] >= METER.checkpoints.hearts && (
                      <span className="cg-hearts" aria-hidden="true">
                        <i>♥</i><i>♥</i><i>♥</i><i>♥</i>
                      </span>
                    )}
                    {floaters.filter((f) => f.catId === cat.id).map((f) => (
                      <span key={f.id} className="cg-plus" aria-hidden="true" style={{ "--dx": `${f.dx}px` } as CSSProperties}>+1</span>
                    ))}
                    <img src={happy[cat.id] ? cat.happy : cat.neutral} alt="" draggable={false} />
                  </button>
                  <figcaption>{cat.name}</figcaption>
                </figure>
              );
            })}
          </div>

          <div className="cg-bottom">
            <div className="cg-stats">
              <div className="cg-tile"><span>Pets</span><b>{pets}</b></div>
              <div className="cg-tile"><span>Streak</span><b>{streak}</b></div>
              <div className="cg-tile"><span>Best</span><b>{best}</b></div>
            </div>

            <div className="cg-meter">
              <div className="cg-label">purr-o-meter</div>
              {cats.map((cat) => {
                const pct = Math.min(100, Math.max(0, (meters[cat.id] / METER.max) * 100));
                return (
                  <div key={cat.id} className={`cg-mrow${activeCatId === cat.id ? " on" : ""}`}>
                    <span className="cg-mname">{cat.name}</span>
                    <div className="cg-track" role="progressbar" aria-label={`${cat.name}'s purr-o-meter`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                      <div className="cg-fill" style={{ width: `${pct}%` }} />
                      {ticks.map((t) => (
                        <i key={t} className="cg-tick" style={{ left: `${(t / METER.max) * 100}%` }} aria-hidden="true" />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="cg-note">
                <p className="cg-hint" aria-hidden={message ? true : undefined} style={{ visibility: message ? "hidden" : "visible" }}>
                  fill it all the way for a surprise
                </p>
                <p className="cg-msg" role="status" aria-live="polite">{message}</p>
              </div>
              <div className="cg-actions">
                <button className="cg-btn cg-mute" type="button" role="switch" aria-checked={!muted} onClick={toggleMute}>
                  sound: {muted ? "off" : "on"}
                </button>
                <button className="cg-btn" type="button" onClick={onReset}>Reset</button>
              </div>
            </div>

            <p className="cg-tip">tip: hold down to keep petting</p>
          </div>
        </div>
      </div>
    </div>
  );
}
