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
  const [consoleOpen, setConsoleOpen] = useState(false);

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
    setConsoleOpen(true);
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
  const applyFix = useCallback((changes) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    editor.executeEdits("ai-fix", changes.map(c => {
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
        <div className="text-lg font-bold tracking-tight">ACQR <span className="text-sm font-normal text-text-muted ml-2">AI Code Reviewer</span></div>
        <div className="flex items-center gap-4">
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Analyzing..." : "Analyze Code"}
          </button>
        </div>
      </header>

      {/* ── Top Area: Editor & Analysis (75% height) ──────────────────────── */}
      <div className="flex flex-row flex-1 overflow-hidden">
        
        {/* LEFT PANEL (Editor) */}
        <div className="w-1/2 flex flex-col p-4 bg-base border-r border-border">
          <div className="flex-1 rounded-xl overflow-hidden border border-slate-700 bg-surface transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500/50">
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={v => setCode(v || "")}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 24,
                padding: { top: 16, bottom: 16 },
                scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
              }}
            />
          </div>
          <div className="mt-4 flex justify-center">
            <button 
              className="btn-primary px-8 py-3 text-sm transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]" 
              onClick={runAnalysis} 
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Analyze Code"}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL (Analysis) */}
        <div className="w-1/2 flex flex-col p-4 bg-surface-2 overflow-y-auto">
          {/* Empty state */}
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center text-text-muted gap-2 animate-fade-in">
              <span className="text-5xl text-slate-600 mb-2">🔍</span>
              <p className="font-semibold text-slate-300 text-lg">No analysis yet</p>
              <p className="text-sm">Click analyze to review your code.</p>
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

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col gap-4 animate-pulse">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-24 rounded-xl bg-surface border border-border"></div>
              ))}
            </div>
          )}

          {/* Issues List */}
          <div className="flex flex-col gap-4">
            {flat.map((group, gi) => (
              <div key={gi} className="flex flex-col gap-4">
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

      {/* ── BOTTOM PANEL (Console) ────────────────────────────────────────── */}
      <div className="h-[25%] w-full border-t border-border bg-base overflow-y-auto p-4 flex flex-col font-mono text-sm">
        <h3 className="text-xs font-bold text-text-muted uppercase mb-2">Console Output</h3>
        <div className="flex-1 overflow-y-auto">
          <AnimatedTerminal execution={execution} />
        </div>
      </div>
    </div>
  );
}
