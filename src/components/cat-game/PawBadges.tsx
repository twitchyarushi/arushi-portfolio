"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { BADGES_EVENT, CATS, type CatId } from "./config";
import { loadPersisted } from "./useCatGame";
import "./cat-game.css";

/**
 * Row of earned paw badges (read from localStorage), shown above the Resume/Contact links.
 * Refreshes live while the game is open (the game fires BADGES_EVENT), and on `storage`
 * events from other tabs. Newly earned badges "stick on"; reset makes them disappear.
 */
export default function PawBadges() {
  const [badges, setBadges] = useState<CatId[]>([]);
  const [fresh, setFresh] = useState<CatId[]>([]);
  const current = useRef<CatId[]>([]);
  const loaded = useRef(false); // badges already owned at page load don't animate

  const sync = useCallback(() => {
    let next: CatId[] = [];
    try {
      next = loadPersisted(window.localStorage).badges;
    } catch {
      /* blocked storage: show nothing */
    }
    const prev = current.current;
    const isFirst = !loaded.current;
    loaded.current = true;
    if (next.length === prev.length && next.every((b) => prev.includes(b))) return;
    setFresh(isFirst ? [] : next.filter((b) => !prev.includes(b)));
    current.current = next;
    setBadges(next);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener(BADGES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BADGES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  const owned = CATS.filter((c) => badges.includes(c.id));
  if (!owned.length) return null;

  return (
    <ul className="paws" aria-label="Paw badges">
      {owned.map((c) => (
        <li key={c.id} className={`paw${fresh.includes(c.id) ? " fresh" : ""}`}>
          <img src={c.paw} alt={`${c.color} paw badge`} draggable={false} />
        </li>
      ))}
    </ul>
  );
}
