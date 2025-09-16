import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// Click cells to toggle. Starts automatically with a random board.
const makeGrid = (rows, cols, fill = 0) => Array.from({ length: rows }, () => Array(cols).fill(fill));

const neighbours = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

const PATTERNS = {
  Glider: [[0,1],[1,2],[2,0],[2,1],[2,2]],
  "Small exploder": [[1,0],[0,1],[1,1],[2,1],[0,2],[2,2],[1,3]],
  Toad: [[1,1],[1,2],[1,3],[2,0],[2,1],[2,2]],
  Beacon: [[0,0],[0,1],[1,0],[2,3],[3,2],[3,3]],
  Pulsar: [
    [2,4],[2,5],[2,6],[2,10],[2,11],[2,12],
    [4,2],[5,2],[6,2],[4,7],[5,7],[6,7],[4,9],[5,9],[6,9],[4,14],[5,14],[6,14],
    [7,4],[7,5],[7,6],[7,10],[7,11],[7,12],
    [9,4],[9,5],[9,6],[9,10],[9,11],[9,12],
    [10,2],[11,2],[12,2],[10,7],[11,7],[12,7],[10,9],[11,9],[12,9],[10,14],[11,14],[12,14],
    [14,4],[14,5],[14,6],[14,10],[14,11],[14,12]
  ]
};

const MIN_CELL_SIZE = 4;
const MAX_CELL_SIZE = 18;
const CELL_GAP = 1;

const BlueBadge = ({ children }) => (
  <span className="inline-flex items-center gap-2 rounded-xl bg-blue-100 text-blue-800 px-3 py-1 text-sm font-semibold shadow-sm">
    {children}
  </span>
);

export default function App() {
  const [rows, setRows] = useState(35);
  const [cols, setCols] = useState(55);
  const [grid, setGrid] = useState(() => makeGrid(35, 55, 0));
  const [running, setRunning] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [speed, setSpeed] = useState(120);
  const boardWrapperRef = useRef(null);
  const [cellSize, setCellSize] = useState(MAX_CELL_SIZE);
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    setGrid(g => {
      const newGrid = makeGrid(rows, cols, 0);
      for (let r = 0; r < Math.min(rows, g.length); r++) {
        for (let c = 0; c < Math.min(cols, g[0].length); c++) {
          newGrid[r][c] = g[r][c];
        }
      }
      return newGrid;
    });
  }, [rows, cols]);

  const randomise = useCallback(() => {
    setGrid(() => {
      const g = makeGrid(rows, cols, 0);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          g[r][c] = Math.random() > 0.7 ? 1 : 0;
        }
      }
      return g;
    });
    setGeneration(0);
  }, [rows, cols]);

  const clear = useCallback(() => {
    setGrid(makeGrid(rows, cols, 0));
    setGeneration(0);
  }, [rows, cols]);

  const toggleCell = useCallback((r, c) => {
    setGrid(g => {
      const copy = g.map(row => row.slice());
      copy[r][c] = g[r][c] ? 0 : 1;
      return copy;
    });
  }, []);

  const stepOnce = useCallback(() => {
    setGrid(g => {
      const next = makeGrid(rows, cols, 0);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let live = 0;
          for (const [dr, dc] of neighbours) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              live += g[nr][nc];
            }
          }
          if (g[r][c] === 1) {
            next[r][c] = live === 2 || live === 3 ? 1 : 0;
          } else {
            next[r][c] = live === 3 ? 1 : 0;
          }
        }
      }
      return next;
    });
    setGeneration(n => n + 1);
  }, [rows, cols]);

  useEffect(() => {
    randomise();
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (!runningRef.current) return;
      stepOnce();
    }, Math.max(30, speed));
    return () => clearInterval(id);
  }, [running, speed, stepOnce]);

  const loadPattern = useCallback((name) => {
    const coords = PATTERNS[name];
    if (!coords) return;
    setGrid(() => {
      const fresh = makeGrid(rows, cols, 0);
      const minR = Math.min(...coords.map(([r]) => r));
      const minC = Math.min(...coords.map(([,c]) => c));
      const maxR = Math.max(...coords.map(([r]) => r));
      const maxC = Math.max(...coords.map(([,c]) => c));
      const boxH = maxR - minR + 1;
      const boxW = maxC - minC + 1;
      const startR = Math.floor((rows - boxH) / 2);
      const startC = Math.floor((cols - boxW) / 2);
      for (const [r, c] of coords) {
        const rr = startR + (r - minR);
        const cc = startC + (c - minC);
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) fresh[rr][cc] = 1;
      }
      return fresh;
    });
    setGeneration(0);
  }, [rows, cols]);

  const liveCount = useMemo(() => grid.flat().reduce((a, b) => a + b, 0), [grid]);

  useEffect(() => {
    const updateSize = () => {
      const node = boardWrapperRef.current;
      if (!node || !cols) return;
      const available = node.clientWidth - Math.max(0, cols - 1) * CELL_GAP;
      const raw = Math.floor(available / cols);
      const clamped = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, raw));
      setCellSize(prev => (prev === clamped ? prev : clamped));
    };

    updateSize();

    const node = boardWrapperRef.current;
    if (!node) return;

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(updateSize);
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [cols]);

  const gridStyle = useMemo(() => ({
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
    gap: CELL_GAP,
    justifyContent: "center"
  }), [cellSize, cols]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 via-blue-900 to-slate-950 text-slate-100 p-4 md:p-8">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-blue-100 drop-shadow-sm">
          Conway’s Game of Life
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-xl bg-blue-100 text-blue-800 px-3 py-1 text-sm font-semibold shadow-sm">Generation: {generation}</span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-blue-100 text-blue-800 px-3 py-1 text-sm font-semibold shadow-sm">Live cells: {liveCount}</span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-blue-100 text-blue-800 px-3 py-1 text-sm font-semibold shadow-sm">{running ? "Running" : "Paused"}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <section className="bg-blue-950/40 border border-blue-800/40 rounded-2xl p-3 md:p-4 shadow-xl backdrop-blur">
          <div ref={boardWrapperRef} className="mx-auto w-full overflow-x-auto">
            <div className="mx-auto select-none" style={gridStyle}>
              {grid.map((row, r) =>
                row.map((cell, c) => (
                  <button
                    key={`${r}-${c}`}
                    aria-label={`Cell ${r + 1}, ${c + 1}`}
                    onClick={() => toggleCell(r, c)}
                    className={
                      "rounded-sm border transition-colors duration-150 " +
                      (cell
                        ? "bg-blue-400/90 border-blue-300 shadow-inner hover:bg-blue-300"
                        : "bg-blue-950/20 border-blue-800/50 hover:bg-blue-900/40")
                    }
                    style={{ width: cellSize, height: cellSize }}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="bg-slate-900/40 border border-blue-800/40 rounded-2xl p-4 shadow-xl backdrop-blur">
          <h2 className="text-xl font-semibold mb-3 text-blue-100">Controls</h2>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={() => setRunning(r => !r)}
                className="w-full rounded-xl py-2 px-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold shadow sm:col-span-2"
              >
                {running ? "Pause" : "Start"}
              </button>
              <button
                onClick={stepOnce}
                disabled={running}
                className="w-full rounded-xl py-2 px-3 bg-blue-700/70 hover:bg-blue-600/80 disabled:opacity-50 disabled:hover:bg-blue-700/70 text-white font-medium shadow"
              >
                Step once
              </button>
              <button
                onClick={randomise}
                className="w-full rounded-xl py-2 px-3 bg-blue-700/70 hover:bg-blue-600/80 text-white font-medium shadow"
              >
                Randomise
              </button>
              <button
                onClick={clear}
                className="w-full rounded-xl py-2 px-3 bg-sky-700/70 hover:bg-sky-600/80 text-white font-medium shadow"
              >
                Clear board
              </button>
              <button
                onClick={() => { setRunning(false); setGeneration(0); }}
                className="w-full rounded-xl py-2 px-3 bg-indigo-700/70 hover:bg-indigo-600/80 text-white font-medium shadow sm:col-span-2"
              >
                Stop and reset counter
              </button>
            </div>

            <div className="mt-1">
              <label className="block text-sm mb-1">Speed in milliseconds</label>
              <input type="range" min={30} max={500} value={speed} onChange={e => setSpeed(Number(e.target.value))} className="w-full" />
              <div className="text-xs text-blue-200 mt-1">{speed} ms per generation</div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="block text-sm mb-1">Rows</label>
                <input type="number" min={10} max={80} value={rows} onChange={e => setRows(Number(e.target.value) || 0)} className="w-full rounded-lg bg-slate-800 border border-blue-800 px-2 py-1" />
              </div>
              <div>
                <label className="block text-sm mb-1">Columns</label>
                <input type="number" min={10} max={100} value={cols} onChange={e => setCols(Number(e.target.value) || 0)} className="w-full rounded-lg bg-slate-800 border border-blue-800 px-2 py-1" />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Load a pattern</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select id="pattern" className="w-full rounded-lg bg-slate-800 border border-blue-800 px-2 py-2 sm:flex-1" onChange={(e) => loadPattern(e.target.value)} defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {Object.keys(PATTERNS).map(p => (<option key={p} value={p}>{p}</option>))}
                </select>
                <button onClick={() => setRunning(true)} className="w-full rounded-xl py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow sm:w-auto">Start</button>
              </div>
            </div>

            <div className="text-xs text-blue-200 leading-relaxed mt-1">
              Tip: click cells to set up the board while paused. Start to watch the evolution.
            </div>
          </div>
        </aside>
      </main>

      <footer className="max-w-6xl mx-auto mt-8 text-sm text-blue-200/80">
        Rules: any live cell with fewer than two neighbours dies; any live cell with two or three neighbours survives; any live cell with more than three neighbours dies; any dead cell with exactly three neighbours becomes alive.
      </footer>
    </div>
  );
}
