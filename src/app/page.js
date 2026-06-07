"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  loadGraph,
  generatePuzzle,
  validateStep,
  getActorName,
  getMovieTitle,
  getHint,
  shortestPath,
  findActor,
  findMovie,
} from "./engine";

// ── Decorative components ──────────────────────────────────────────────────

function FilmStrip({ top }) {
  return (
    <div style={{
      position: "fixed",
      [top ? "top" : "bottom"]: 0,
      left: 0, right: 0, height: 28,
      background: "#111",
      display: "flex", alignItems: "center", gap: 12, padding: "0 8px",
      zIndex: 200, overflowX: "hidden",
    }}>
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} style={{
          width: 14, height: 10, borderRadius: 2,
          background: "#2a2a2a", border: "1px solid #333", flexShrink: 0,
        }} />
      ))}
    </div>
  );
}

function Stars() {
  const s = Array.from({ length: 55 }, (_, i) => ({
    x: (i * 41.3) % 100, y: (i * 27.7) % 100,
    sz: (i % 3) * 0.7 + 0.6, op: ((i % 5) + 1) * 0.07,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {s.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
          width: p.sz, height: p.sz, borderRadius: "50%",
          background: "#fff", opacity: p.op,
        }} />
      ))}
    </div>
  );
}

// ── Autocomplete input ─────────────────────────────────────────────────────

function AutoInput({ label, placeholder, value, onChange, onSelect, suggestions, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{
        display: "block", color: "#666", fontSize: 11,
        letterSpacing: "0.1em", textTransform: "uppercase",
        marginBottom: 6, fontFamily: "'Courier Prime', monospace",
      }}>{label}</label>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%", background: "rgba(255,255,255,0.05)",
          border: "1px solid #3a3a3a", borderRadius: 8,
          color: "#f0e6c8", padding: "10px 14px",
          fontFamily: "'Courier Prime', monospace", fontSize: 14, outline: "none",
        }}
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 300,
          background: "#1a1a1a", border: "1px solid #3a3a3a", borderRadius: 8,
          marginTop: 4, maxHeight: 200, overflowY: "auto",
        }}>
          {suggestions.slice(0, 8).map((s, i) => (
            <div
              key={i}
              onMouseDown={() => { onSelect(s); setOpen(false); }}
              style={{
                padding: "9px 14px", cursor: "pointer",
                fontFamily: "'Courier Prime', monospace", fontSize: 13, color: "#ccc",
                borderBottom: i < suggestions.length - 1 ? "1px solid #2a2a2a" : "none",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chain display ──────────────────────────────────────────────────────────

function Chain({ steps, finalActorName }) {
  if (!steps.length) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {steps.map((s, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              background: "rgba(212,175,55,0.15)", border: "1px solid #d4af37",
              color: "#d4af37", borderRadius: 6, padding: "3px 10px",
              fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 600,
            }}>{s.actorName}</span>
            <span style={{ color: "#555", fontSize: 12 }}>in</span>
            <span style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid #333",
              color: "#bbb", borderRadius: 6, padding: "3px 10px",
              fontFamily: "'Courier Prime', monospace", fontSize: 12, fontStyle: "italic",
            }}>{s.movieTitle}</span>
            <span style={{ color: "#444", fontSize: 18 }}>→</span>
          </span>
        ))}
        <span style={{
          background: "rgba(255,100,100,0.1)", border: "1px solid #b04040",
          color: "#e08080", borderRadius: 6, padding: "3px 10px",
          fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 600,
        }}>{finalActorName} (?)</span>
      </div>
    </div>
  );
}

// ── Autocomplete suggestion logic ──────────────────────────────────────────

function actorSuggestions(graph, query) {
  if (!graph || query.length < 2) return [];
  const q = query.toLowerCase();
  return Object.values(graph.actors)
    .map(a => a.name)
    .filter(n => n.toLowerCase().includes(q))
    .sort((a, b) => {
      const ai = a.toLowerCase().indexOf(q);
      const bi = b.toLowerCase().indexOf(q);
      return ai - bi || a.localeCompare(b);
    })
    .slice(0, 8);
}

function movieSuggestions(graph, query) {
  if (!graph || query.length < 2) return [];
  const q = query.toLowerCase();
  return Object.values(graph.movies)
    .map(m => m.title)
    .filter(t => t.toLowerCase().includes(q))
    .sort((a, b) => {
      const ai = a.toLowerCase().indexOf(q);
      const bi = b.toLowerCase().indexOf(q);
      return ai - bi || a.localeCompare(b);
    })
    .slice(0, 8);
}

// ── Main component ─────────────────────────────────────────────────────────

const GOLD = "#d4af37";
const RED  = "#e08080";

export default function App() {
  const [graph, setGraph] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [screen, setScreen] = useState("menu");   // menu | game | win | nopath
  const [difficulty, setDifficulty] = useState(null);

  // Puzzle state
  const [actor1Id, setActor1Id] = useState(null);
  const [actor2Id, setActor2Id] = useState(null);
  const [currentActorId, setCurrentActorId] = useState(null);
  const [steps, setSteps] = useState([]);          // [{actorName, movieTitle}]
  const [usedMovieIds, setUsedMovieIds] = useState([]);
  const [moves, setMoves] = useState(0);
  const [bestScores, setBestScores] = useState({});

  // Input state
  const [movieQ, setMovieQ] = useState("");
  const [actorQ, setActorQ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);  // {text, ok}
  const [hint, setHint] = useState(null);

  // Load graph on mount
  useEffect(() => {
    fetch("/data/graph.json")
      .then(r => { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then(g => { loadGraph(g); setGraph(g); })
      .catch(() => setLoadError(true));
  }, []);

  const startGame = useCallback((diff) => {
    const puzzle = generatePuzzle(diff);
    if (!puzzle) { setScreen("nopath"); return; }
    setDifficulty(diff);
    setActor1Id(puzzle.actor1Id);
    setActor2Id(puzzle.actor2Id);
    setCurrentActorId(puzzle.actor1Id);
    setSteps([]);
    setUsedMovieIds([]);
    setMoves(0);
    setMovieQ("");
    setActorQ("");
    setFeedback(null);
    setHint(null);
    setScreen("game");
  }, []);

  const submitStep = useCallback(() => {
    if (!movieQ.trim() || !actorQ.trim() || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    setHint(null);

    const result = validateStep(currentActorId, movieQ, actorQ);
    if (!result.valid) {
      setFeedback({ text: result.error, ok: false });
      setSubmitting(false);
      return;
    }

    const newSteps = [...steps, { actorName: getActorName(currentActorId), movieTitle: result.movieTitle }];
    const newMoves = moves + 1;
    setSteps(newSteps);
    setMoves(newMoves);
    setUsedMovieIds(prev => [...prev, result.movieId]);
    setMovieQ("");
    setActorQ("");

    if (result.actor2Id === actor2Id) {
      setBestScores(prev => {
        const old = prev[difficulty];
        return (!old || newMoves < old) ? { ...prev, [difficulty]: newMoves } : prev;
      });
      setScreen("win");
    } else {
      setCurrentActorId(result.actor2Id);
      setFeedback({ text: `✓ Confirmed! ${result.actor2Name} was in "${result.movieTitle}". Keep going…`, ok: true });
    }
    setSubmitting(false);
  }, [movieQ, actorQ, submitting, currentActorId, steps, moves, actor2Id, difficulty]);

  const showHint = useCallback(() => {
    const h = getHint(currentActorId, actor2Id, usedMovieIds);
    setHint(h);
  }, [currentActorId, actor2Id, usedMovieIds]);

  // ── Data loading states ──────────────────────────────────────────────────

  if (loadError) return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 32 }}>
      <div style={{ fontSize: 48 }}>🎬</div>
      <div style={{ color: "#e08080", fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 700 }}>Dataset Not Found</div>
      <div style={{ color: "#666", fontFamily: "'Courier Prime', monospace", fontSize: 13, textAlign: "center", maxWidth: 460, lineHeight: 1.8 }}>
        The game data file <code style={{ color: "#aaa" }}>public/data/graph.json</code> is missing.<br />
        Run the build script first:<br />
        <span style={{ color: "#d4af37" }}>npm run build-data</span><br />
        Then restart the dev server.
      </div>
    </div>
  );

  if (!graph) return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 40 }}>🎬</div>
      <div style={{ color: "#d4af37", fontFamily: "'Courier Prime', monospace", fontSize: 14 }}>Loading the archives…</div>
    </div>
  );

  // ── MENU ─────────────────────────────────────────────────────────────────

  if (screen === "menu") return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 20%, #1a1005 0%, #080808 70%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 20px", position: "relative" }}>
      <Stars /><FilmStrip top /><FilmStrip />
      <div style={{ position: "relative", zIndex: 10, textAlign: "center", maxWidth: 560, width: "100%" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.4em", color: GOLD, textTransform: "uppercase", marginBottom: 12, fontFamily: "'Courier Prime', monospace" }}>★ A Hollywood Quiz Game ★</div>
        <h1 style={{ fontSize: "clamp(2.4rem,8vw,4.5rem)", fontWeight: 900, color: "#f0e6c8", margin: 0, lineHeight: 1, textShadow: `0 0 60px rgba(212,175,55,0.3)` }}>Hollywood</h1>
        <h1 style={{ fontSize: "clamp(2.4rem,8vw,4.5rem)", fontWeight: 900, color: GOLD, margin: "0 0 14px", lineHeight: 1 }}>Connections</h1>
        <p style={{ color: "#666", fontFamily: "'Courier Prime', monospace", fontSize: 14, margin: "0 0 10px", lineHeight: 1.7 }}>
          Connect two stars by naming shared films and co-stars.<br />
          Fewer moves = better score. Powered by real IMDb data.
        </p>
        <div style={{ color: "#3a3a3a", fontSize: 11, fontFamily: "'Courier Prime', monospace", marginBottom: 36 }}>
          {Object.keys(graph.actors).length.toLocaleString()} actors · {Object.keys(graph.movies).length.toLocaleString()} movies
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 32 }}>
          {["Easy", "Medium", "Hard"].map(d => (
            <button key={d} onClick={() => startGame(d)} style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a2a",
              borderRadius: 12, padding: "20px 12px", cursor: "pointer", color: "#f0e6c8", textAlign: "center",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,175,55,0.08)"; e.currentTarget.style.borderColor = GOLD; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "#2a2a2a"; }}
            >
              <div style={{ fontSize: 26, marginBottom: 6 }}>{d === "Easy" ? "🎬" : d === "Medium" ? "🎭" : "🏆"}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{d}</div>
              <div style={{ color: "#555", fontSize: 11, fontFamily: "'Courier Prime', monospace" }}>
                {d === "Easy" ? "1–2 degrees apart" : d === "Medium" ? "2–3 degrees apart" : "3–4 degrees apart"}
              </div>
              {bestScores[d] && <div style={{ color: GOLD, fontSize: 11, marginTop: 8, fontFamily: "'Courier Prime', monospace" }}>Best: {bestScores[d]} move{bestScores[d] !== 1 ? "s" : ""}</div>}
            </button>
          ))}
        </div>

        <div style={{ color: "#3a3a3a", fontSize: 12, fontFamily: "'Courier Prime', monospace", lineHeight: 1.9 }}>
          e.g. <span style={{ color: "#777" }}>Hugo Weaving</span> → <em>The Matrix</em> → <span style={{ color: "#777" }}>Keanu Reeves</span> → <em>Speed</em> → <span style={{ color: "#777" }}>Sandra Bullock</span>
        </div>
      </div>
    </div>
  );

  // ── WIN ──────────────────────────────────────────────────────────────────

  if (screen === "win") return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 30%, #1a1208 0%, #080808 70%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 20px", position: "relative" }}>
      <Stars /><FilmStrip top /><FilmStrip />
      <div style={{ position: "relative", zIndex: 10, textAlign: "center", maxWidth: 560, width: "100%" }}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>🏆</div>
        <h2 style={{ color: GOLD, fontSize: "2rem", margin: "0 0 8px" }}>Connected!</h2>
        <p style={{ color: "#666", fontFamily: "'Courier Prime', monospace", fontSize: 14, marginBottom: 24 }}>
          {getActorName(actor1Id)} → {getActorName(actor2Id)} in <strong style={{ color: GOLD }}>{moves}</strong> move{moves !== 1 ? "s" : ""}
        </p>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 24, textAlign: "left" }}>
          <div style={{ color: "#444", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontFamily: "'Courier Prime', monospace" }}>Your path</div>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>{s.actorName}</span>
              <span style={{ color: "#444", fontSize: 12 }}>in</span>
              <span style={{ color: "#aaa", fontStyle: "italic", fontFamily: "'Courier Prime', monospace", fontSize: 13 }}>{s.movieTitle}</span>
            </div>
          ))}
          <div style={{ color: RED, fontWeight: 700, fontSize: 14, marginTop: 4 }}>→ {getActorName(actor2Id)} ✓</div>
        </div>

        {/* Show optimal path if player took more than optimal */}
        <OptimalPath actor1Id={actor1Id} actor2Id={actor2Id} playerMoves={moves} />

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={() => startGame(difficulty)} style={{ background: `linear-gradient(135deg, ${GOLD}, #9a7318)`, border: "none", borderRadius: 8, color: "#1a1208", padding: "12px 28px", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Play Again</button>
          <button onClick={() => setScreen("menu")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #333", borderRadius: 8, color: "#aaa", padding: "12px 28px", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Menu</button>
        </div>
      </div>
    </div>
  );

  // ── GAME ─────────────────────────────────────────────────────────────────

  const actor1Name = getActorName(actor1Id);
  const actor2Name = getActorName(actor2Id);
  const currentName = getActorName(currentActorId);

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 10%, #120e05 0%, #080808 70%)", padding: "48px 20px", position: "relative" }}>
      <Stars /><FilmStrip top /><FilmStrip />
      <div style={{ maxWidth: 640, margin: "0 auto", position: "relative", zIndex: 10 }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <button onClick={() => setScreen("menu")} style={{ background: "none", border: "1px solid #222", borderRadius: 6, color: "#555", padding: "6px 14px", fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer" }}>← Menu</button>
          <div style={{ color: GOLD, fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'Courier Prime', monospace" }}>
            {difficulty} · {moves} move{moves !== 1 ? "s" : ""}
          </div>
          <button onClick={showHint} style={{ background: "none", border: "1px solid #222", borderRadius: 6, color: "#666", padding: "6px 14px", fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer" }}>
            💡 Hint
          </button>
        </div>

        {/* Challenge banner */}
        <div style={{ textAlign: "center", marginBottom: 28, padding: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid #1c1c1c", borderRadius: 12 }}>
          <div style={{ color: "#3a3a3a", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Courier Prime', monospace", marginBottom: 10 }}>Connect the Stars</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ color: GOLD, fontWeight: 900, fontSize: "clamp(1.1rem,4vw,1.5rem)" }}>{actor1Name}</span>
            <span style={{ color: "#2a2a2a", fontSize: "1.5rem" }}>⟷</span>
            <span style={{ color: RED, fontWeight: 900, fontSize: "clamp(1.1rem,4vw,1.5rem)" }}>{actor2Name}</span>
          </div>
        </div>

        {/* Chain so far */}
        {steps.length > 0 && <Chain steps={steps} finalActorName={actor2Name} />}

        {/* Input */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ color: "#888", fontSize: 13, marginBottom: 16, fontFamily: "'Courier Prime', monospace" }}>
            Connect <span style={{ color: GOLD, fontWeight: 600 }}>{currentName}</span> toward <span style={{ color: RED, fontWeight: 600 }}>{actor2Name}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <AutoInput
              label="Movie / Film"
              placeholder={`A film with ${currentName}…`}
              value={movieQ}
              onChange={setMovieQ}
              onSelect={v => setMovieQ(v)}
              suggestions={movieSuggestions(graph, movieQ)}
              disabled={submitting}
            />
            <AutoInput
              label="Co-star in that film"
              placeholder="Their co-star…"
              value={actorQ}
              onChange={setActorQ}
              onSelect={v => setActorQ(v)}
              suggestions={actorSuggestions(graph, actorQ)}
              disabled={submitting}
            />
          </div>
          <button
            onClick={submitStep}
            disabled={submitting || !movieQ.trim() || !actorQ.trim()}
            onKeyDown={e => e.key === "Enter" && submitStep()}
            style={{
              width: "100%",
              background: submitting || !movieQ.trim() || !actorQ.trim() ? "#1a1a1a" : `linear-gradient(135deg, ${GOLD}, #9a7318)`,
              border: "none", borderRadius: 8,
              color: submitting || !movieQ.trim() || !actorQ.trim() ? "#444" : "#1a1208",
              padding: "11px 24px", fontFamily: "'Playfair Display', serif",
              fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer",
              letterSpacing: "0.05em",
            }}
          >
            {submitting ? "Checking…" : "Confirm Connection →"}
          </button>
        </div>

        {/* Feedback */}
        {feedback && (
          <div style={{
            padding: "11px 16px", borderRadius: 8, marginBottom: 12,
            background: feedback.ok ? "rgba(70,140,70,0.08)" : "rgba(160,50,50,0.08)",
            border: `1px solid ${feedback.ok ? "#2a4a2a" : "#4a1a1a"}`,
            color: feedback.ok ? "#5a9a5a" : "#a06060",
            fontFamily: "'Courier Prime', monospace", fontSize: 13,
          }}>
            {feedback.text}
          </div>
        )}

        {/* Hint */}
        {hint && (
          <div style={{
            padding: "11px 16px", borderRadius: 8, marginBottom: 12,
            background: "rgba(212,175,55,0.05)", border: "1px solid #3a2e10",
            color: "#907820", fontFamily: "'Courier Prime', monospace",
            fontSize: 13, fontStyle: "italic",
          }}>
            💡 {hint}
          </div>
        )}

        {/* How to play */}
        <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid #181818" }}>
          <div style={{ color: "#3a3a3a", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'Courier Prime', monospace", marginBottom: 6 }}>How to play</div>
          <div style={{ color: "#3a3a3a", fontSize: 12, fontFamily: "'Courier Prime', monospace", lineHeight: 1.7 }}>
            Name a <span style={{ color: "#777" }}>movie</span> featuring <span style={{ color: GOLD }}>{currentName}</span>, then name a <span style={{ color: "#777" }}>co-star</span>. Keep chaining until you reach <span style={{ color: RED }}>{actor2Name}</span>. Autocomplete helps — just start typing.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Optimal path reveal on win screen ─────────────────────────────────────

function OptimalPath({ actor1Id, actor2Id, playerMoves }) {
  const [path, setPath] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const p = shortestPath(actor1Id, actor2Id);
    setPath(p);
  }, [actor1Id, actor2Id]);

  if (!path) return null;
  const optMoves = path.filter(s => s.movieId !== null).length;
  if (playerMoves <= optMoves) return (
    <div style={{ color: "#5a9a5a", fontFamily: "'Courier Prime', monospace", fontSize: 13, marginBottom: 20 }}>
      ⭐ You matched the optimal path ({optMoves} move{optMoves !== 1 ? "s" : ""})!
    </div>
  );

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: "#666", fontFamily: "'Courier Prime', monospace", fontSize: 13, marginBottom: 8 }}>
        Optimal path was {optMoves} move{optMoves !== 1 ? "s" : ""}.{" "}
        <button onClick={() => setShow(!show)} style={{ background: "none", border: "none", color: GOLD, cursor: "pointer", fontFamily: "'Courier Prime', monospace", fontSize: 13, textDecoration: "underline" }}>
          {show ? "Hide" : "Show it"}
        </button>
      </div>
      {show && (
        <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid #3a2e10", borderRadius: 8, padding: "12px 16px", textAlign: "left" }}>
          {path.filter(s => s.movieId).map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap", fontFamily: "'Courier Prime', monospace", fontSize: 12 }}>
              <span style={{ color: GOLD }}>{getActorName(s.actorId)}</span>
              <span style={{ color: "#444" }}>in</span>
              <span style={{ color: "#888", fontStyle: "italic" }}>{getMovieTitle(s.movieId)}</span>
            </div>
          ))}
          <div style={{ color: RED, fontFamily: "'Courier Prime', monospace", fontSize: 12, marginTop: 4 }}>
            → {getActorName(actor2Id)}
          </div>
        </div>
      )}
    </div>
  );
}
