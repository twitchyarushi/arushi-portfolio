"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import "../cat-game/cat-game.css"; // shell: .cg-ov .cg-wrap .cg .cg-x .cg-btn
import "./f1.css";
import { ROWS, teamColour } from "./config";
import { countdown } from "./mapF1";
import { useF1 } from "./useF1";

type Row = { pos: number; name: string; team: string; teamId: string; points: number | null };

const pad = (n: number) => String(n).padStart(2, "0");
const pts = (n: number | null) => (n === null ? "000" : String(n));
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const driverPlaceholders: Row[] = Array.from({ length: ROWS.drivers }, (_, i) => ({
  pos: i + 1, name: "Driver name", team: "Team name", teamId: "", points: null,
}));
const constructorPlaceholders: Row[] = Array.from({ length: ROWS.constructors }, (_, i) => ({
  pos: i + 1, name: "Team name", team: "", teamId: "", points: null,
}));

export default function F1Modal({ onClose }: { onClose?: () => void }) {
  const { data, loading, error, retry } = useF1();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [badCircuit, setBadCircuit] = useState<string | null>(null); // circuit whose SVG failed to load
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => { dialogRef.current?.focus({ preventScroll: true }); }, []);

  const waiting = loading && !data; // first load: placeholders pulse
  const pulse = waiting ? " pulse" : "";
  const loaded = data !== null;

  const drivers = data?.drivers ?? null;
  const constructors = data?.constructors ?? null;
  const next = data?.next ?? null;
  const cd = next ? countdown(next.dateISO, now) : null;
  const started = cd?.started ?? false;

  /* countdown: refresh now when the race arrives, then every 30s until it starts */
  useEffect(() => {
    if (!next || started) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [next?.dateISO, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const canExpand = !!drivers && drivers.length > ROWS.drivers;
  const showAll = expanded && canExpand;
  const toggleAll = () => {
    if (showAll && listRef.current) listRef.current.scrollTop = 0;
    setExpanded(!showAll);
  };
  const showCircuit = !!next?.circuitId && badCircuit !== next.circuitId;

  const driverRows: Row[] = drivers
    ? drivers.slice(0, showAll ? drivers.length : ROWS.drivers).map((d) => ({ pos: d.pos, name: d.name, team: d.team, teamId: d.teamId, points: d.points }))
    : driverPlaceholders;
  const constructorRows: Row[] = constructors
    ? constructors.slice(0, ROWS.constructors).map((c) => ({ pos: c.pos, name: c.name, team: "", teamId: c.teamId, points: c.points }))
    : constructorPlaceholders;

  return (
    <div className="cg-ov" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="cg-wrap">
        <div className="cg f1" role="dialog" aria-modal="true" aria-labelledby="f1-title" tabIndex={-1} ref={dialogRef}>
          <button className="cg-x" type="button" aria-label="Close" onClick={onClose}>×</button>

          <header className="f1-head">
            <img className="f1-plate" src="/scrapbook/plate.webp" alt="" draggable={false} />
            <div>
              <h2 id="f1-title">Formula 1</h2>
              <p className="f1-subtitle">{data?.season ? `${data.season} season · ` : ""}live standings · i enjoy watching F1 from time to time</p>
            </div>
          </header>

          {error && (
            <div className="f1-err" role="alert">
              <span>couldn’t reach the standings</span>
              <button className="cg-btn f1-retry" type="button" onClick={retry}>Retry</button>
            </div>
          )}

          <div className="f1-cols">
            <section aria-labelledby="f1-drivers">
              <h3 id="f1-drivers" className="f1-h">Drivers’ standings</h3>
              {drivers && drivers.length === 0 ? (
                <p className="f1-empty">no standings yet</p>
              ) : (
                <ol id="f1-driver-list" ref={listRef} className={`f1-drivers${drivers ? "" : ` ph${pulse}`}${showAll ? " open" : ""}`}>
                  {driverRows.map((r, i) => (
                    <li key={i} className={i === 0 ? "first" : undefined}>
                      <i className="f1-bar" style={{ background: teamColour(r.teamId) }} aria-hidden="true" />
                      <span className="f1-pos">{r.pos}</span>
                      <span className="f1-who">
                        <b>{r.name}</b>
                        <em>{r.team}</em>
                      </span>
                      <span className="f1-pts">{pts(r.points)}</span>
                    </li>
                  ))}
                </ol>
              )}
              {canExpand ? (
                <button type="button" className="f1-more" aria-expanded={showAll} aria-controls="f1-driver-list" onClick={toggleAll}>
                  {showAll ? "show top 5" : "see full standings"}
                </button>
              ) : (
                <span className="f1-more">see full standings</span>
              )}
            </section>

            <div>
              <section className={`f1-next${loaded ? "" : ` ph${pulse}`}`} aria-label="Next race">
                {loaded && !next ? (
                  <>
                    <p className="f1-kicker">Next race</p>
                    <h3 className="f1-gp">Season complete</h3>
                  </>
                ) : (
                  <>
                    <p className="f1-kicker">Next race · Round {next ? pad(next.round) : "00"}</p>
                    <h3 className="f1-gp">{next?.name ?? "Grand Prix name"}</h3>
                    <p className="f1-date">{next ? formatDate(next.dateISO) : "00 Month 2026"}</p>
                    <div className={`f1-circuit${showCircuit ? " has-img" : ""}`}>
                      {next && showCircuit ? (
                        <img
                          src={`/f1/circuits/${next.circuitId}.svg`}
                          alt={`${next.circuitName} circuit outline`}
                          draggable={false}
                          onError={() => setBadCircuit(next.circuitId)}
                        />
                      ) : next ? (
                        [next.circuitName, next.place].filter(Boolean).join(" · ")
                      ) : (
                        "circuit outline"
                      )}
                    </div>
                    {cd?.started ? (
                      <p className="f1-started">race weekend!</p>
                    ) : (
                      <div className="f1-tiles">
                        <span>{cd ? pad(cd.d) : "00"} d</span>
                        <span>{cd ? pad(cd.h) : "00"} h</span>
                        <span>{cd ? pad(cd.m) : "00"} m</span>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section aria-labelledby="f1-cons">
                <h3 id="f1-cons" className="f1-h">Constructors</h3>
                {constructors && constructors.length === 0 ? (
                  <p className="f1-empty">no standings yet</p>
                ) : (
                  <ol className={`f1-cons${constructors ? "" : ` ph${pulse}`}`}>
                    {constructorRows.map((r, i) => (
                      <li key={i}>
                        <span className="f1-pos">{r.pos}</span>
                        <span className="f1-team">{r.name}</span>
                        <span className="f1-pts">{pts(r.points)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </div>

          <p className="f1-foot">Data: Jolpica F1 API · refreshes after each race</p>
        </div>
      </div>
    </div>
  );
}