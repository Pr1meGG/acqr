import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import IssueCard from "./components/IssueCard";
import AnimatedTerminal from "./components/AnimatedTerminal";

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://acqr.onrender.com";
const SEV_VALUE = { error: 3, warning: 2, info: 1 };

const SUCCESS_MESSAGES = [
  { title: "✨ Clean Code", desc: "Everything looks solid." },
  { title: "🚀 Looking Good", desc: "No issues found in your logic." },
  { title: "✅ All Clear", desc: "Ready for production." },
  { title: "🔥 Perfect Score", desc: "Flawless execution." },
];

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
    "# Write your code and press Analyze\nprint(\"Hello, ACQR!\")\n\nx = 10\nif x > 5\n  print(\"x is big\")"
  );
  const [result,       setResult]       = useState(null);
  const [execution,    setExecution]    = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [reqError,     setReqError]     = useState("");
  const [activeIdx,    setActiveIdx]    = useState(-1);
  const [hoverIdx,     setHoverIdx]     = useState(-1);
  const [consoleOpen,  setConsoleOpen]  = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);

  const editorRef    = useRef(null);
  const monacoRef    = useRef(null);
  const decoRef      = useRef([]);
  const stateRef     = useRef({ run: null, loading: false, applyFix: null });
  const activeIdxRef = useRef(-1);
  const flatRef      = useRef([]);

  const grouped    = useMemo(() => groupErrors(result?.errors), [result]);
  const flat       = useMemo(() => buildFlat(grouped), [grouped]);
  const issueCount = result?.errors?.length ?? 0;
  
  const successMsg = useMemo(() => {
    if (result && issueCount === 0) {
      return SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
    }
    return SUCCESS_MESSAGES[0];
  }, [result, issueCount]);

  useEffect(() => { flatRef.current = flat; }, [flat]);
  useEffect(() => { if (result !== null) setPanelVisible(true); }, [result]);

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
      setReqError("Cannot reach backend.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  // ── Apply fix ─────────────────────────────────────────────────────────────
  const applyFix = useCallback((fixOrChanges, flatIndex, issueMsg) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    let changes;
    if (Array.isArray(fixOrChanges))               changes = fixOrChanges;
    else if (fixOrChanges?.type === "replace_line") changes = [{ line_start: fixOrChanges.line, line_end: fixOrChanges.line, replacement: fixOrChanges.new_code }];
    else if (fixOrChanges?.changes)                changes = fixOrChanges.changes;
    else return;
    editor.executeEdits("acqr-fix", changes.map(c => {
      const endCol = editor.getModel().getLineMaxColumn(c.line_end);
      return { range: new monaco.Range(c.line_start, 1, c.line_end, endCol), text: c.replacement };
    }));
    
    // Log success to console
    setExecution(prev => ({
      ...prev,
      output: (prev?.output ? prev.output + "\n" : "") + `[ACQR] ⚡ Applied fix: ${issueMsg || "Automatic correction"}\n[ACQR] ✓ Code updated successfully.`
    }));
  }, []);

  const handleRemoveIssue = useCallback((flatIndex) => {
    setResult(prev => {
      if (!prev) return prev;
      const targetGroup = flatRef.current.find(g => g.issues.some(i => i.flatIndex === flatIndex));
      if (!targetGroup) return prev;
      const targetIssue = targetGroup.issues.find(i => i.flatIndex === flatIndex);
      return {
        ...prev,
        errors: (prev.errors || []).filter(e => !(e.line === targetIssue.line && e.error === targetIssue.error))
      };
    });
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

  useEffect(() => { stateRef.current = { run: runAnalysis, loading, applyFix }; });
  useEffect(() => { setActiveIdx(-1); activeIdxRef.current = -1; }, [result]);

  useEffect(() => {
    if (activeIdx < 0) return;
    for (const g of flatRef.current)
      for (const issue of g.issues)
        if (issue.flatIndex === activeIdx) { scrollToLine(issue.line); return; }
  }, [activeIdx, scrollToLine]);

  // ── Monaco decorations ────────────────────────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    const maxLine = model.getLineCount();
    
    const decos = flatRef.current.flatMap(g => 
      g.issues
        .filter(e => Number.isInteger(e.line) && e.line >= 1 && e.line <= maxLine)
        .map(e => {
          const isHovered = e.flatIndex === hoverIdx || e.flatIndex === activeIdx;
          const sevClass = e.sev === "warning" ? "acqr-warning-line" : "acqr-error-line";
          return {
            range: new monaco.Range(e.line, 1, e.line, 1),
            options: {
              isWholeLine: true,
              className: `${sevClass} ${isHovered ? "acqr-line-hover" : ""}`.trim(),
              glyphMarginClassName: e.sev === "warning" ? "acqr-warning-glyph" : "acqr-error-glyph",
              inlineClassName: "acqr-error-underline",
              hoverMessage: { value: `$(${e.severity || "error"}) ${e.error || ""}` },
            },
          };
        })
    );
    decoRef.current = editor.deltaDecorations(decoRef.current, decos);
  }, [result, hoverIdx, activeIdx]);

  // ── Monaco mount ──────────────────────────────────────────────────────────
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (!stateRef.current.loading) stateRef.current.run();
    });
  };

  // ── Global keyboard ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const mod = navigator.platform.toUpperCase().includes("MAC") ? e.metaKey : e.ctrlKey;
      if (mod && e.key === "Enter") { e.preventDefault(); if (!stateRef.current.loading) stateRef.current.run(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Editor border state ───────────────────────────────────────────────────
  const editorBorderStyle = issueCount > 0
    ? { border: "1px solid rgba(244,63,94,0.4)", boxShadow: "0 0 0 3px rgba(244,63,94,0.08), inset 0 0 30px rgba(244,63,94,0.03)" }
    : result !== null
    ? { border: "1px solid rgba(16,185,129,0.35)", boxShadow: "0 0 0 3px rgba(16,185,129,0.06), inset 0 0 30px rgba(16,185,129,0.02)" }
    : { border: "1px solid rgba(99,102,241,0.15)", boxShadow: "none" };

  return (
    <div
      className="flex flex-col h-screen w-screen text-text overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #020817 0%, #060d1f 40%, #080f22 100%)",
      }}
    >
      {/* ── Ambient background glows ──────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 10% -10%, rgba(99,102,241,0.08), transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 110%, rgba(6,182,212,0.06), transparent 60%)
          `,
        }}
      />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="relative z-10 flex items-center justify-between px-6 py-3.5 flex-shrink-0"
        style={{
          background: "rgba(6,10,22,0.8)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(99,102,241,0.1)",
          boxShadow: "0 1px 0 rgba(99,102,241,0.05), 0 4px 20px rgba(0,0,0,0.4)",
        }}
      >
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                boxShadow: "0 0 12px rgba(99,102,241,0.6)",
              }}
            >
              <span className="text-white text-xs font-black">A</span>
            </div>
            <div
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse-soft"
              style={{ background: "#22d3ee", boxShadow: "0 0 8px rgba(6,182,212,0.9)" }}
            />
          </div>
          <div>
            <span
              className="font-black tracking-tight text-[16px]"
              style={{
                background: "linear-gradient(90deg, #818cf8, #22d3ee)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              ACQR
            </span>
            <span className="text-text-muted text-[12px] ml-2 font-medium">AI Code Reviewer</span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {reqError && (
            <span className="text-[11px] text-[#fb7185] bg-[#f43f5e]/10 px-3 py-1 rounded-full border border-[#f43f5e]/20">
              {reqError}
            </span>
          )}
          {result && !loading && (
            <span
              className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-all duration-300 ${
                issueCount === 0
                  ? "text-[#34d399] bg-[#10b981]/10 border-[#10b981]/25"
                  : "text-[#fb7185] bg-[#f43f5e]/10 border-[#f43f5e]/25"
              }`}
            >
              {issueCount === 0 ? "✓ All clean" : `${issueCount} issue${issueCount !== 1 ? "s" : ""} found`}
            </span>
          )}
          <button onClick={runAnalysis} disabled={loading} className="btn-primary px-5 py-2.5">
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

      {/* ── Main workspace ────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-row flex-1 overflow-hidden">

        {/* ── EDITOR PANEL ───────────────────────────────────────────── */}
        <div
          className="flex flex-col p-4 transition-all duration-300 ease-in-out"
          style={{ width: panelVisible ? "60%" : "100%" }}
        >
          {/* Editor container */}
          <div
            className="flex-1 rounded-2xl overflow-hidden transition-all duration-300"
            style={editorBorderStyle}
          >
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
                fontLigatures: true,
                lineHeight: 24,
                padding: { top: 20, bottom: 20 },
                scrollbar: { verticalScrollbarSize: 3, horizontalScrollbarSize: 3 },
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                smoothScrolling: true,
              }}
            />
          </div>

          {/* Hint */}
          <p className="mt-2 px-1 text-[11px] text-text-muted italic transition-opacity duration-200">
            {loading
              ? "⟳ Analyzing…"
              : result
              ? "Edit and re-analyze · Ctrl+Enter"
              : "Write code and press Analyze · Ctrl+Enter"}
          </p>
        </div>

        {/* ── ISSUE PANEL ────────────────────────────────────────────── */}
        <div
          className="flex flex-col overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            width: panelVisible ? "40%" : "0%",
            opacity: panelVisible ? 1 : 0,
            borderLeft: "1px solid rgba(99,102,241,0.1)",
            background: "rgba(8,13,30,0.7)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="flex flex-col flex-1 overflow-y-auto p-4 min-w-[300px]">

            {/* ── Loading skeletons ──────────────────────────────────── */}
            {loading && (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map(n => (
                  <div
                    key={n}
                    className="h-24 rounded-xl animate-pulse"
                    style={{
                      background: "linear-gradient(90deg, rgba(11,21,48,0.8) 25%, rgba(17,31,66,0.8) 50%, rgba(11,21,48,0.8) 75%)",
                      backgroundSize: "200% 100%",
                      animation: `shimmer 1.5s linear infinite, pulse 2s ease-in-out infinite`,
                      border: "1px solid rgba(99,102,241,0.1)",
                    }}
                  />
                ))}
              </div>
            )}

            {/* ── Success state ─────────────────────────────────────── */}
            {result && !loading && issueCount === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-5 animate-fade-in px-4 text-center">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))",
                    border: "1px solid rgba(16,185,129,0.3)",
                    boxShadow: "0 0 40px rgba(16,185,129,0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
                  }}
                >
                  ✓
                </div>
                <div>
                  <p
                    className="font-black text-xl mb-1"
                    style={{
                      background: "linear-gradient(90deg, #34d399, #22d3ee)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {successMsg.title}
                  </p>
                  <p className="text-[13px] text-text-muted mt-2">{successMsg.desc}</p>
                </div>
                <button
                  onClick={() => {
                    setCode("# Try breaking it!\nx = \"hello\nprint(x\nif True\n  pass");
                    setResult(null);
                    setPanelVisible(false);
                  }}
                  className="btn-ghost text-[12px] mt-1"
                >
                  Try breaking your code →
                </button>
              </div>
            )}

            {/* ── Issues list ───────────────────────────────────────── */}
            {result && !loading && issueCount > 0 && (
              <div className="flex flex-col gap-4">
                {/* Panel header */}
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                    Issues
                  </p>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      color: "#fb7185",
                      background: "rgba(244,63,94,0.12)",
                      border: "1px solid rgba(244,63,94,0.25)",
                    }}
                  >
                    {issueCount}
                  </span>
                </div>

                {flat.map((group, gi) => (
                  <div key={gi} className="flex flex-col gap-4">
                    {group.issues.map((err, ei) => (
                      <IssueCard
                        key={ei}
                        err={err}
                        isActive={err.flatIndex === activeIdx}
                        onApplyFix={applyFix}
                        onRemoveIssue={handleRemoveIssue}
                        onHover={setHoverIdx}
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
            )}
          </div>
        </div>
      </div>

      {/* ── Floating Console ─────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 right-0 z-50 overflow-hidden flex flex-col transition-all duration-300 ease-in-out"
        style={{
          width: "480px",
          height: consoleOpen ? 190 : 0,
          background: "rgba(4, 8, 20, 0.95)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(99,102,241,0.15)",
          borderLeft: "1px solid rgba(99,102,241,0.15)",
          borderRadius: "16px 0 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.08)",
        }}
      >
        <div
          className="px-4 py-2.5 flex items-center gap-2 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(99,102,241,0.1)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#22d3ee", boxShadow: "0 0 6px rgba(6,182,212,0.9)" }}
          />
          <span className="text-[10px] font-mono font-semibold text-text-muted uppercase tracking-widest">
            Console
          </span>
          {execution && (
            <span
              className={`ml-auto text-[10px] font-mono font-bold ${execution.error ? "text-[#fb7185]" : "text-[#34d399]"}`}
            >
              {execution.error ? "● ERR" : "● OK"}
            </span>
          )}
          <button
            onClick={() => setConsoleOpen(false)}
            className="ml-2 text-text-muted hover:text-slate-200 text-sm transition-colors"
          >✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AnimatedTerminal execution={execution} />
        </div>
      </div>

      {/* ── Console FAB ──────────────────────────────────────────────── */}
      <button
        onClick={() => setConsoleOpen(v => !v)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 font-mono text-[11px] px-4 py-2 rounded-full transition-all duration-200"
        style={{
          background: "rgba(8,13,30,0.9)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(99,102,241,0.2)",
          color: "#64748b",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)";
          e.currentTarget.style.color = "#e2e8f0";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.5), 0 0 16px rgba(99,102,241,0.2)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)";
          e.currentTarget.style.color = "#64748b";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.5)";
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: execution ? (execution.error ? "#f43f5e" : "#10b981") : "#374151",
            boxShadow: execution ? (execution.error ? "0 0 6px rgba(244,63,94,0.8)" : "0 0 6px rgba(16,185,129,0.8)") : "none",
          }}
        />
        {consoleOpen ? "Hide Output" : "Show Output"}
      </button>
    </div>
  );
}
