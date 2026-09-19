import React, { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import IssueCard from "./components/IssueCard";
import InteractiveTerminal from "./components/InteractiveTerminal";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SAMPLE = `# Write your Python code here!
`;

export default function App() {
  const [code, setCode] = useState(SAMPLE);
  const [result, setResult] = useState(null);
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reqError, setReqError] = useState("");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [runTrigger, setRunTrigger] = useState(0);
  
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const runAnalysis = useCallback(async () => {
    if (!code.trim() || loading) return;
    setReqError("");
    setLoading(true);
    setExecution(null);
    setReviewed(false);
    try {
      setRunTrigger(prev => prev + 1);
      setConsoleOpen(true);
      const aRes = await fetch(`${API_BASE_URL}/analyze`,  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      setResult(await aRes.json());
      setReviewed(true);
    } catch {
      setReqError("Cannot reach backend.");
    } finally {
      setLoading(false);
    }
  }, [code, loading]);

  const applyFix = useCallback((newCode) => {
    setCode(newCode);
    setResult(null);
  }, []);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runAnalysis();
    });
  };

  const reset = () => {
    setCode(SAMPLE);
    setResult(null);
    setExecution(null);
    setReviewed(false);
    setConsoleOpen(false);
  };

  const issues = result?.errors || [];
  const primaryIssue = issues[0];

  const currentKind = runTrigger > 0 ? "ok" : "";

  return (
    <>
      <a className="skip" href="#code">Skip to code editor</a>
      <div className="grain" aria-hidden="true"></div>
      <div className="chroma" aria-hidden="true">
        <span className="c-rust"></span>
        <span className="c-saffron"></span>
        <span className="c-clay"></span>
      </div>

      <header className="top">
        <div className="brand">
          <img src="/logo/mark-on-dark.svg" alt="ACQR Logo" className="brand-logo-mark" style={{ height: "22px", width: "auto" }} />
          <div className="brand-type">
            <span className="wordmark">ACQR</span>
            <span className="brand-meta">Code Review</span>
          </div>
        </div>

        <div className="top-actions">
          <span className="lang-stamp" title="Language">Python</span>
          {primaryIssue && (
            <p className="issue-meta" id="issueMeta">
              {issues.length} issue{issues.length !== 1 ? 's' : ''} · line {primaryIssue.line}
            </p>
          )}
          <button
            className="btn btn-ghost"
            id="termBtn"
            type="button"
            aria-expanded={consoleOpen}
            aria-controls="outputDock"
            onClick={() => setConsoleOpen(!consoleOpen)}
          >
            {consoleOpen ? "Hide terminal" : "Show terminal"}
          </button>
          <button className="btn btn-ghost" id="resetBtn" type="button" onClick={reset}>
            Reset
          </button>
          <button
            className={`btn btn-primary ${loading ? 'is-busy' : ''}`}
            id="reviewBtn"
            type="button"
            onClick={runAnalysis}
            disabled={loading}
          >
            <span className="btn-label">Review</span>
          </button>
        </div>
      </header>

      <main className="studio">
        <section className="pane editor-pane" aria-label="Code editor">
          <div className="pane-head">
            <span className="kicker">Editor</span>
            <span className="pane-note" id="editorNote">Untitled · py</span>
          </div>
          <div className="editor" id="editor" style={{ display: 'block', position: 'relative' }}>
             <Editor
                height="100%"
                defaultLanguage="python"
                theme="vs-dark"
                value={code}
                onChange={v => {
                    setCode(v || "");
                    if(reviewed) setReviewed(false);
                }}
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13.5,
                  fontFamily: "var(--font-mono)",
                  lineHeight: 24,
                  padding: { top: 20, bottom: 20 },
                  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                  cursorBlinking: "smooth",
                }}
              />
          </div>
          <div className="pane-foot">
            <span id="statusLeft">
              {loading ? "Reading…" : reviewed && primaryIssue ? "Repair needed" : reviewed && !primaryIssue ? "Reviewed" : "Edit freely"}
            </span>
            <span className="kbd-hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to review</span>
          </div>
        </section>

        <section className="pane lesson-pane" aria-label="Review">
          <div className="pane-head">
            <span className="kicker">Lesson</span>
            <button
              className="text-btn"
              id="outputToggle"
              type="button"
              aria-expanded={consoleOpen}
              aria-controls="outputDock"
              onClick={() => setConsoleOpen(!consoleOpen)}
            >
              Terminal
            </button>
          </div>
          
          <div className="lesson-scroll" id="lesson">
            {!reviewed && !primaryIssue && (
                <div className="empty" id="emptyState">
                  <p className="empty-kicker">01 — Start here</p>
                  <h1>Paste a few lines. I will read them with you.</h1>
                  <p className="lede">
                    ACQR is a quiet tutor. It explains what your code is doing, then
                    points at the exact line that needs work — and why.
                  </p>
                  <ol className="steps">
                    <li>Write or paste Python on the left.</li>
                    <li>Press <strong>Review</strong>.</li>
                    <li>Read the lesson. Apply the fix when you are ready.</li>
                  </ol>
                </div>
            )}

            {reviewed && !primaryIssue && (
                <div>
                    <p className="issue-kicker is-ok">No blocking errors</p>
                    <h2 className="issue-title">This snippet can run.</h2>
                    <p className="issue-body">
                      The code runs without any critical syntax or logical errors.
                    </p>
                    <section className="section s-avoid">
                      <h2>What the code does</h2>
                      <p>All looks good. You can view the output in the terminal.</p>
                    </section>
                </div>
            )}

            {reviewed && primaryIssue && (
                <IssueCard 
                    issue={primaryIssue} 
                    onFix={() => {
                        if (primaryIssue.fix?.changes?.[0]?.replacement) {
                            const lines = code.split("\n");
                            lines[primaryIssue.line - 1] = primaryIssue.fix.changes[0].replacement;
                            applyFix(lines.join("\n"));
                        }
                    }} 
                    onShowOut={() => setConsoleOpen(true)}
                />
            )}
          </div>
        </section>
      </main>

      <aside className={`output-dock ${consoleOpen ? 'is-open' : ''}`} id="outputDock" aria-hidden={!consoleOpen}>
        <div className="output-bar">
          <span className="kicker">Terminal</span>
          <span className={`output-flag ${currentKind === "err" ? "is-err" : currentKind === "ok" ? "is-ok" : ""}`} id="outputFlag">
             {currentKind === "err" ? "Error" : currentKind === "ok" ? "Clear" : "Idle"}
          </span>
          <button
            className="icon-btn"
            id="outputClose"
            type="button"
            aria-label="Hide terminal"
            onClick={() => setConsoleOpen(false)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        </div>
        <div className="output-body" id="outputBody" style={{ padding: 0 }}>
            {runTrigger === 0 ? (
                <div style={{ padding: '16px', color: '#888' }}>No output yet. Press Review to run this snippet.</div>
            ) : (
                <InteractiveTerminal code={code} runTrigger={runTrigger} />
            )}
        </div>
      </aside>
    </>
  );
}
