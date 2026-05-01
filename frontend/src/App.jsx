import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import IssueCard from "./components/IssueCard";
import AnimatedTerminal from "./components/AnimatedTerminal";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const SEV_VALUE = { error: 3, warning: 2, info: 1 };

function groupErrors(errors) {
  if (!errors?.length) return [];
  const map = {};
  errors.forEach(err => {
    const line = err.line ?? "General";
    if (!map[line]) map[line] = { line, issues: [], maxSev: 0 };
    const sv = SEV_VALUE[err.severity || "error"] || 0;
    if (sv > map[line].maxSev) map[line].maxSev = sv;
    if (!map[line].issues.some(x => x.error === err.error)) map[line].issues.push(err);
  });
  return Object.values(map).sort((a, b) => {
    if (a.maxSev !== b.maxSev) return b.maxSev - a.maxSev;
    if (a.line === "General") return -1;
    if (b.line === "General") return 1;
    return Number(a.line) - Number(b.line);
  });
}

function buildFlat(groups) {
  let i = 0;
  return groups.map(g => ({
    ...g,
    issues: g.issues.map(issue => ({ ...issue, flatIndex: i++ })),
  }));
}

export default function App() {
  const [code, setCode] = useState(
    '# Write your code here... ACQR will analyze it instantly\nprint("Hello ACQR!")\n\nx = 10\nif x > 5\n  print("x is big")'
  );
  const [result,      setResult]      = useState(null);
  const [execution,   setExecution]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [reqError,    setReqError]    = useState("");
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const [consoleOpen, setConsoleOpen] = useState(false); // hidden by default

  const editorRef    = useRef(null);
  const monacoRef    = useRef(null);
  const decoRef      = useRef([]);
  const stateRef     = useRef({ run: null, loading: false, applyFix: null });
  const activeIdxRef = useRef(-1);
  const flatRef      = useRef([]);

  const grouped    = useMemo(() => groupErrors(result?.errors), [result]);
  const flat       = useMemo(() => buildFlat(grouped), [grouped]);
  const issueCount = result?.errors?.length ?? 0;

  useEffect(() => { flatRef.current = flat; }, [flat]);

  // ── Analysis ──────────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (!code.trim() || stateRef.current.loading) return;
    setReqError("");
    setLoading(true);
    setExecution(null);
    try {
      const [aRes, rRes] = await Promise.all([
        fetch(`${API_BASE_URL}/analyze`,  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }),
        fetch(`${API_BASE_URL}/run-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }),
      ]);
      setResult(await aRes.json());
      setExecution(await rRes.json());
    } catch {
      setReqError("Cannot reach backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, [code]);

  // ── Apply fix ─────────────────────────────────────────────────────────────
  // Accepts either:
  //   fix.type === "replace_line" → { line, new_code }
  //   legacy                      → changes[] with { line_start, line_end, replacement }
  const applyFix = useCallback((fixOrChanges) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    // Normalise to a flat changes array
    let changes;
    if (Array.isArray(fixOrChanges)) {
      // Legacy: called with err.fix.changes directly
      changes = fixOrChanges;
    } else if (fixOrChanges?.type === "replace_line") {
      changes = [{ line_start: fixOrChanges.line, line_end: fixOrChanges.line, replacement: fixOrChanges.new_code }];
    } else if (fixOrChanges?.changes) {
      changes = fixOrChanges.changes;
    } else {
      return;
    }

    editor.executeEdits("acqr-fix", changes.map(c => {
      const endCol = editor.getModel().getLineMaxColumn(c.line_end);
      return { range: new monaco.Range(c.line_start, 1, c.line_end, endCol), text: c.replacement };
    }));
  }, []);

  // ── Scroll to line ────────────────────────────────────────────────────────
  const scrollToLine = useCallback((line) => {
    const editor = editorRef.current;
    if (!editor || !line) return;
    const n = Number(line);
    if (isNaN(n)) return;
    editor.revealLineInCenter(n);
    editor.setPosition({ lineNumber: n, column: 1 });
    editor.focus();
  }, []);

  // ── Sync stateRef ──────────────────────────────────────────────────────────
  useEffect(() => {
    stateRef.current = { run: runAnalysis, loading, applyFix };
  });

  // ── Reset on new result ────────────────────────────────────────────────────
  useEffect(() => {
    setActiveIdx(-1);
    activeIdxRef.current = -1;
  }, [result]);

  // ── Auto-scroll editor to active issue ────────────────────────────────────
  useEffect(() => {
    if (activeIdx < 0) return;
    for (const g of flatRef.current) {
      for (const issue of g.issues) {
        if (issue.flatIndex === activeIdx) { scrollToLine(issue.line); return; }
      }
    }
  }, [activeIdx, scrollToLine]);

  // ── Monaco decorations ─────────────────────────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    const maxLine = model.getLineCount();
    const decos = (result?.errors ?? [])
      .map(e => ({ line: Number(e?.line), sev: e.severity || "error", msg: e?.error || "" }))
      .filter(e => Number.isInteger(e.line) && e.line >= 1 && e.line <= maxLine)
      .map(e => ({
        range: new monaco.Range(e.line, 1, e.line, 1),
        options: {
          isWholeLine: true,
          className: e.sev === "warning" ? "acqr-warning-line" : "acqr-error-line",
          glyphMarginClassName: e.sev === "warning" ? "acqr-warning-glyph" : "acqr-error-glyph",
          inlineClassName: "acqr-error-underline",
          hoverMessage: { value: `$(${e.sev}) ${e.msg}` },
        },
      }));
    decoRef.current = editor.deltaDecorations(decoRef.current, decos);
  }, [result]);

  // ── Monaco mount ───────────────────────────────────────────────────────────
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (!stateRef.current.loading) stateRef.current.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period, () => {
      const idx = activeIdxRef.current;
      for (const g of flatRef.current) {
        for (const issue of g.issues) {
          if (issue.flatIndex === idx && issue.fix?.changes) {
            stateRef.current.applyFix(issue.fix.changes);
            return;
          }
        }
      }
    });
  };

  // ── Global keyboard ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const mod = navigator.platform.toUpperCase().includes("MAC") ? e.metaKey : e.ctrlKey;

      if (mod && e.key === "Enter") {
        e.preventDefault();
        if (!stateRef.current.loading) stateRef.current.run();
        return;
      }

      if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        setActiveIdx(prev => {
          const max = flatRef.current.reduce((a, g) => a + g.issues.length, 0) - 1;
          if (max < 0) return prev;
          const next = e.key === "ArrowDown" ? Math.min(prev + 1, max) : Math.max(prev - 1, 0);
          activeIdxRef.current = next;
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-base text-text overflow-hidden">
      
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" style={{ boxShadow: "0 0 8px rgba(59,130,246,0.7)" }} />
          <span className="font-bold tracking-tight text-[15px]">ACQR</span>
          <span className="text-text-muted text-[13px]">&bull; AI Code Reviewer</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="btn-primary px-5 py-2 text-sm transition-all duration-200
                       hover:scale-105 hover:shadow-[0_0_14px_rgba(59,130,246,0.4)]
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Analyzing…
              </span>
            ) : "Analyze Code"}
          </button>
        </div>
      </header>

      {/* ── Top Area: Editor & Analysis (75% height) ──────────────────────── */}
      <div className="flex flex-row flex-1 overflow-hidden">
        
        {/* LEFT PANEL (Editor) — 60% */}
        <div className="w-[60%] flex flex-col p-4 bg-base border-r border-border">
          <div className={`flex-1 rounded-xl overflow-hidden border bg-surface transition-all duration-300 focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500/50 ${issueCount > 0 ? "border-red-500/50 ring-2 ring-red-500/30" : "border-slate-700"}`}>
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={v => setCode(v || "")}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                glyphMargin: true,
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 24,
                padding: { top: 16, bottom: 16 },
                scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
              }}
            />
          </div>
          {/* Keyboard hint only */}
          <p className="mt-2.5 px-1 text-xs text-text-muted italic">Press Ctrl+Enter to analyze…</p>
        </div>

        {/* RIGHT PANEL (Analysis) — 40% */}
        <div className="w-[40%] flex flex-col py-4 px-3 bg-surface-2 overflow-y-auto">
          {/* Empty state */}
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center text-text-muted gap-2 animate-fade-in">
              <span className="text-5xl text-slate-600 mb-2">🔍</span>
              <p className="font-semibold text-slate-300 text-lg">No analysis yet</p>
              <p className="text-sm">Click Analyze to review your code.</p>
            </div>
          )}

          {/* Clean state */}
          {result && issueCount === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-success gap-2 animate-fade-in">
              <span className="text-6xl mb-2" style={{ textShadow: "0 0 20px rgba(16,185,129,0.4)" }}>✓</span>
              <p className="font-bold text-lg">No issues found</p>
              <p className="text-sm text-slate-400">Your code is clean and ready 🚀</p>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="flex flex-col gap-5 animate-pulse">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-28 rounded-xl bg-surface border border-border" />
              ))}
            </div>
          )}

          {/* Issues List */}
          <div className="flex flex-col gap-5">
            {flat.map((group, gi) => (
              <div key={gi} className="flex flex-col gap-5">
                {group.issues.map((err, ei) => (
                  <IssueCard
                    key={ei}
                    err={err}
                    isActive={err.flatIndex === activeIdx}
                    onApplyFix={applyFix}
                    onLineClick={() => {
                      setActiveIdx(err.flatIndex);
                      activeIdxRef.current = err.flatIndex;
                      scrollToLine(err.line);
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Floating Console (bottom-right) ─────────────────────────────── */}
      {/* Slide-up panel */}
      <div
        className="fixed bottom-0 right-0 w-[480px] bg-[#080e1a] border border-border/60 rounded-tl-2xl
                   shadow-[0_-8px_32px_rgba(0,0,0,0.5)] flex flex-col
                   transition-all duration-300 ease-in-out overflow-hidden z-50"
        style={{ height: consoleOpen ? 220 : 0 }}
      >
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border/50 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-green-500" style={{ boxShadow: "0 0 6px rgba(16,185,129,0.7)" }} />
          <span className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-widest">Console</span>
          {execution && (
            <span className={`ml-auto text-[11px] font-mono font-bold ${execution.error ? "text-red-400" : "text-green-400"}`}>
              {execution.error ? "● ERR" : "● OK"}
            </span>
          )}
          <button
            onClick={() => setConsoleOpen(false)}
            className="ml-2 text-text-muted hover:text-slate-200 text-[13px] transition-colors"
          >✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AnimatedTerminal execution={execution} />
        </div>
      </div>

      {/* FAB toggle */}
      <button
        onClick={() => setConsoleOpen(v => !v)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 font-mono text-[12px]
                   bg-[#0d1b2e] hover:bg-[#0f2040] border border-border hover:border-border-2
                   text-text-muted hover:text-slate-200 rounded-full px-4 py-2
                   shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-200
                   hover:shadow-[0_4px_24px_rgba(59,130,246,0.2)]"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${execution ? (execution.error ? "bg-red-400" : "bg-green-400") : "bg-slate-600"}`} />
        {consoleOpen ? "Hide Output" : "Show Output"}
      </button>
    </div>

  );
}
