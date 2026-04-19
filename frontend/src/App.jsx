import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const ERROR_TAG_PALETTE = {
  Syntax: {
    background: "rgba(248, 113, 113, 0.14)",
    border: "1px solid rgba(248, 113, 113, 0.42)",
    color: "#fecaca",
  },
  "Beginner Mistake": {
    background: "rgba(251, 191, 36, 0.12)",
    border: "1px solid rgba(251, 191, 36, 0.42)",
    color: "#fde68a",
  },
  "Best Practice": {
    background: "rgba(99, 102, 241, 0.18)",
    border: "1px solid rgba(165, 180, 252, 0.42)",
    color: "#c7d2fe",
  },
};

const getTagBadgeStyle = (label) =>
  ERROR_TAG_PALETTE[label] || {
    background: "rgba(148, 163, 184, 0.14)",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    color: "#e2e8f0",
  };

const getErrorTags = (err) => {
  if (Array.isArray(err?.tags) && err.tags.length > 0) {
    return [...new Set(err.tags.map((t) => String(t).trim()).filter(Boolean))];
  }
  if (err?.tag != null && String(err.tag).trim() !== "") {
    return [String(err.tag).trim()];
  }

  const mid = err?.["message-id"] || err?.messageId || "";
  const msg = String(err?.message || "").toLowerCase();
  const out = [];

  if (mid === "E0001" || /\bsyntax\b/.test(msg)) {
    out.push("Syntax");
  }
  if (/^C011/.test(mid) || /docstring/.test(msg)) {
    out.push("Best Practice");
  }
  if (mid === "E0602" || /undefined variable|not defined|name .* not/.test(msg)) {
    out.push("Beginner Mistake");
  }

  const uniq = [...new Set(out)];
  if (uniq.length === 0) {
    if (/missing|unused|warning|style/.test(msg)) {
      uniq.push("Best Practice");
    } else if (/invalid|parse|unexpected/.test(msg)) {
      uniq.push("Syntax");
    } else {
      uniq.push("Beginner Mistake");
    }
  }

  return uniq.slice(0, 3);
};

function App() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [learningMode, setLearningMode] = useState(true);
  const [aiDetails, setAiDetails] = useState({});
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationIdsRef = useRef([]);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    const errors = result?.errors || [];
    const maxLine = model.getLineCount();

    const nextDecorations = errors
      .map((err) => ({
        line: Number(err?.line),
        message: err?.message || "Issue found on this line.",
      }))
      .filter(
        (entry) =>
          Number.isInteger(entry.line) && entry.line >= 1 && entry.line <= maxLine
      )
      .map((entry) => ({
        range: new monaco.Range(entry.line, 1, entry.line, 1),
        options: {
          isWholeLine: true,
          className: "acqr-error-line",
          inlineClassName: "acqr-error-underline",
          hoverMessage: {
            value: `$(error) ${entry.message}`,
          },
        },
      }));

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      nextDecorations
    );
  }, [result]);

  const analyzeCode = async () => {
    if (!code.trim()) {
      alert("Please enter some code first!");
      return;
    }

    setRequestError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        throw new Error("Analysis request failed");
      }

      const data = await res.json();
      setResult(data);
      setAiDetails({});
    } catch (err) {
      console.error(err);
      setRequestError("Unable to analyze code right now. Please try again.");
      alert("Error connecting to backend");
    } finally {
      setLoading(false);
    }
  };

  const getEli5Text = (err) =>
    err?.eli5 ||
    "Think of code like careful instructions: if one part is unclear, the computer pauses and asks you to clarify.";

  const getFixText = (err) =>
    err?.fix ||
    "Read the line carefully, compare it with nearby code, then correct the name or syntax and run the analysis again.";

  const getExampleText = (err) =>
    err?.example || "# Example fix\nvalue = 10\nprint(value)";

  const getLineAt = (source, lineNumber) => {
    const n = Number(lineNumber);
    if (!source || !Number.isInteger(n) || n < 1) {
      return "";
    }
    const lines = source.split(/\r?\n/);
    const line = lines[n - 1];
    return line != null ? line.replace(/\s+$/, "") : "";
  };

  const getYourCodeForPreview = (err) => {
    const fromErr =
      err?.yourCode ??
      err?.your_code ??
      err?.originalLine ??
      err?.original_line ??
      err?.snippet;
    if (fromErr != null && String(fromErr).trim() !== "") {
      return String(fromErr).replace(/\s+$/, "");
    }
    return getLineAt(code, err?.line);
  };

  const getSuggestedFixForPreview = (err) => {
    const fromErr =
      err?.suggestedFix ??
      err?.suggested_fix ??
      err?.suggestedCode ??
      err?.suggested_code ??
      err?.fixed_line ??
      err?.fixedLine;
    if (fromErr != null && String(fromErr).trim() !== "") {
      return String(fromErr).replace(/\s+$/, "");
    }
    const example = getExampleText(err);
    const lines = example.split(/\r?\n/).map((l) => l.trim());
    const firstCode = lines.find((l) => l && !l.startsWith("#"));
    return firstCode || lines[0] || "# suggested fix";
  };

  const getCodeUnderstanding = (sourceCode) => {
    const trimmed = sourceCode.trim();
    if (!trimmed) {
      return "Add code in the editor to see a quick explanation here.";
    }

    const statements = [];

    const hasPrint = /\bprint\s*\(/.test(sourceCode);
    if (hasPrint) {
      statements.push("It prints output to the console using print().");
    }

    const assignmentMatches = sourceCode.match(
      /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*.+$/gm
    );
    if (assignmentMatches?.length) {
      statements.push(
        `It stores values in variable${assignmentMatches.length > 1 ? "s" : ""}.`
      );
    }

    const expressionMatches = sourceCode.match(
      /^\s*[A-Za-z0-9_'"()[\]\s]+\s*[\+\-\*\/%]\s*[A-Za-z0-9_'"()[\]\s]+\s*$/gm
    );
    if (expressionMatches?.length) {
      statements.push("It evaluates simple math or string expressions.");
    }

    if (statements.length === 0) {
      return "This code runs step by step, but it does not match the basic patterns yet.";
    }

    return statements.slice(0, 2).join(" ");
  };

  const handleExplainMore = async (err, index) => {
    const key = String(index);
    const current = aiDetails[key];

    if (current?.loading) {
      return;
    }

    if (current?.open) {
      setAiDetails((prev) => ({
        ...prev,
        [key]: { ...prev[key], open: false },
      }));
      return;
    }

    if (current?.explanation || current?.error) {
      setAiDetails((prev) => ({
        ...prev,
        [key]: { ...prev[key], open: true },
      }));
      return;
    }

    setAiDetails((prev) => ({
      ...prev,
      [key]: {
        open: true,
        loading: true,
        explanation: "",
        error: "",
      },
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/explain-more`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          error: err?.message || "Unknown error",
        }),
      });

      if (!res.ok) {
        throw new Error("Explain more request failed");
      }

      const data = await res.json();
      setAiDetails((prev) => ({
        ...prev,
        [key]: {
          open: true,
          loading: false,
          explanation: data?.explanation || "",
          error: data?.explanation ? "" : "Failed to fetch explanation",
        },
      }));
    } catch (error) {
      console.error(error);
      setAiDetails((prev) => ({
        ...prev,
        [key]: {
          open: true,
          loading: false,
          explanation: "",
          error: "Failed to fetch explanation",
        },
      }));
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        background: "linear-gradient(135deg, #0b1220, #030712)",
        color: "#e2e8f0",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <style>
        {`
          .acqr-error-line {
            background: rgba(248, 113, 113, 0.08);
          }

          .acqr-error-underline {
            text-decoration-line: underline;
            text-decoration-style: wavy;
            text-decoration-color: rgba(248, 113, 113, 0.72);
            text-decoration-thickness: 1px;
            text-underline-offset: 2px;
          }

          .acqr-error-card {
            transition: background-color 160ms ease, box-shadow 160ms ease;
          }

          .acqr-error-card:hover {
            background: rgba(51, 65, 85, 0.52);
            box-shadow: 0 8px 22px rgba(2, 6, 23, 0.28);
          }

          .acqr-button-spinner {
            width: 14px;
            height: 14px;
            border-radius: 999px;
            border: 2px solid rgba(239, 246, 255, 0.45);
            border-top-color: rgba(239, 246, 255, 1);
            animation: acqr-spin 0.8s linear infinite;
          }

          @keyframes acqr-spin {
            to {
              transform: rotate(360deg);
            }
          }

          .acqr-learning-toggle {
            position: relative;
            width: 44px;
            height: 24px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: rgba(30, 41, 59, 0.65);
            cursor: pointer;
            padding: 0;
            flex-shrink: 0;
            transition: background 0.15s ease, border-color 0.15s ease;
          }

          .acqr-learning-toggle[aria-checked="true"] {
            background: rgba(37, 99, 235, 0.55);
            border-color: rgba(147, 197, 253, 0.5);
          }

          .acqr-learning-toggle-thumb {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 18px;
            height: 18px;
            border-radius: 999px;
            background: #f8fafc;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
            transition: transform 0.15s ease;
          }

          .acqr-learning-toggle[aria-checked="true"] .acqr-learning-toggle-thumb {
            transform: translateX(20px);
          }
        `}
      </style>

      <div
        style={{
          width: "70%",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "#f8fafc",
            }}
          >
            ACQR
          </h1>
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: "13px",
              color: "#93c5fd",
            }}
          >
            AI Code Quality Reviewer
          </p>
        </div>

        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || "")}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbersMinChars: 3,
            scrollBeyondLastLine: false,
          }}
        />

        <button
          onClick={analyzeCode}
          disabled={loading}
          style={{
            alignSelf: "flex-start",
            padding: "10px 16px",
            background: "#2563eb",
            border: "1px solid rgba(147, 197, 253, 0.35)",
            borderRadius: "8px",
            color: "#eff6ff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            opacity: loading ? 0.8 : 1,
          }}
        >
          {loading && <span className="acqr-button-spinner" />}
          {loading ? "Analyzing..." : "Analyze"}
        </button>

        {requestError && (
          <p style={{ margin: 0, color: "#fca5a5", fontSize: "13px" }}>{requestError}</p>
        )}
      </div>

      <div
        style={{
          width: "30%",
          padding: "24px",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          background: "rgba(15, 23, 42, 0.45)",
          borderLeft: "1px solid rgba(148, 163, 184, 0.22)",
          boxShadow: "0 12px 32px rgba(2, 6, 23, 0.45)",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "17px",
              fontWeight: 600,
              color: "#f8fafc",
            }}
          >
            Results
          </h2>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#94a3b8",
                whiteSpace: "nowrap",
              }}
            >
              Learning Mode
            </span>
            <button
              type="button"
              className="acqr-learning-toggle"
              role="switch"
              aria-checked={learningMode}
              aria-label="Learning mode"
              onClick={() => setLearningMode((v) => !v)}
            >
              <span className="acqr-learning-toggle-thumb" aria-hidden />
            </button>
          </div>
        </div>

        {!result && (
          <p style={{ color: "#94a3b8", margin: 0 }}>
            Run analysis to see errors.
          </p>
        )}

        {result && (
          <>
            {learningMode && (
              <div
                style={{
                  marginBottom: "14px",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "rgba(30, 41, 59, 0.34)",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px 0",
                    color: "#cbd5e1",
                    fontWeight: 700,
                    fontSize: "13px",
                  }}
                >
                  🧠 What your code does
                </p>
                <p style={{ margin: 0, color: "#93c5fd", fontSize: "13px", lineHeight: 1.5 }}>
                  {getCodeUnderstanding(code)}
                </p>
              </div>
            )}

            {(!result.errors || result.errors.length === 0) && (
              <p style={{ margin: 0, color: "#94a3b8" }}>
                No issues found. Your code looks clean!
              </p>
            )}

            {(result.errors || []).map((err, i) => {
              const errorKey = String(i);
              const aiState = aiDetails[errorKey] || {};

              return (
              <div
                key={errorKey}
                className="acqr-error-card"
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  marginBottom: "14px",
                  background: "rgba(30, 41, 59, 0.38)",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                  boxShadow: "0 4px 14px rgba(2, 6, 23, 0.22)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    marginBottom: "10px",
                  }}
                >
                  {getErrorTags(err).map((tagLabel) => {
                    const s = getTagBadgeStyle(tagLabel);
                    return (
                      <span
                        key={tagLabel}
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 600,
                          letterSpacing: "0.02em",
                          ...s,
                        }}
                      >
                        {tagLabel}
                      </span>
                    );
                  })}
                </div>

                {learningMode && (
                  <p style={{ margin: "0 0 10px 0", color: "#cbd5e1", fontSize: "13px" }}>
                    📍 Line {err.line}
                  </p>
                )}

                {learningMode && (
                  <p
                    style={{
                      margin: "0 0 6px 0",
                      color: "#f87171",
                      fontWeight: 700,
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Error
                  </p>
                )}
                <p
                  style={{
                    margin: learningMode ? "0 0 10px 0" : "0 0 8px 0",
                    color: "#f87171",
                    fontWeight: 600,
                  }}
                >
                  ❌ {err.message}
                </p>

                {learningMode && (
                  <>
                    <p
                      style={{
                        margin: "0 0 6px 0",
                        color: "#60a5fa",
                        fontWeight: 700,
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      Explanation
                    </p>
                    <p style={{ margin: "0 0 10px 0", color: "#60a5fa" }}>
                      📘 {err.explanation || "The code on this line is not valid as written."}
                    </p>

                    <p
                      style={{
                        margin: "0 0 6px 0",
                        color: "#9ca3af",
                        fontWeight: 700,
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      In simple terms
                    </p>
                    <p style={{ margin: "0 0 10px 0", color: "#9ca3af" }}>
                      🧒 {getEli5Text(err)}
                    </p>
                  </>
                )}

                <p
                  style={{
                    margin: "0 0 6px 0",
                    color: "#4ade80",
                    fontWeight: 700,
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  Fix
                </p>
                <p style={{ margin: learningMode ? "0 0 10px 0" : "0 0 8px 0", color: "#4ade80" }}>
                  💡 {getFixText(err)}
                </p>

                <div style={{ marginBottom: learningMode ? "12px" : "0" }}>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      color: "#cbd5e1",
                      fontWeight: 700,
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Fix Preview
                  </p>
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      color: "#fca5a5",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    Your Code
                  </p>
                  <pre
                    style={{
                      margin: "0 0 10px 0",
                      padding: "10px",
                      borderRadius: "8px",
                      background: "rgba(127, 29, 29, 0.22)",
                      border: "1px solid rgba(248, 113, 113, 0.35)",
                      borderLeft: "4px solid #f87171",
                      color: "#fecaca",
                      fontSize: "12px",
                      lineHeight: 1.45,
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <code>{getYourCodeForPreview(err) || "(empty line)"}</code>
                  </pre>
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      color: "#86efac",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    Suggested Fix
                  </p>
                  <pre
                    style={{
                      margin: 0,
                      padding: "10px",
                      borderRadius: "8px",
                      background: "rgba(20, 83, 45, 0.25)",
                      border: "1px solid rgba(74, 222, 128, 0.35)",
                      borderLeft: "4px solid #4ade80",
                      color: "#bbf7d0",
                      fontSize: "12px",
                      lineHeight: 1.45,
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <code>{getSuggestedFixForPreview(err)}</code>
                  </pre>
                </div>

                {learningMode && (
                  <>
                    <p
                      style={{
                        margin: "0 0 6px 0",
                        color: "#cbd5e1",
                        fontWeight: 700,
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      Example
                    </p>
                    <pre
                      style={{
                        margin: 0,
                        padding: "10px",
                        borderRadius: "8px",
                        background: "rgba(2, 6, 23, 0.75)",
                        border: "1px solid rgba(148, 163, 184, 0.2)",
                        color: "#e2e8f0",
                        fontSize: "12px",
                        lineHeight: 1.45,
                        overflowX: "auto",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <code>✅ {getExampleText(err)}</code>
                    </pre>

                    <div style={{ marginTop: "12px" }}>
                      <button
                        onClick={() => handleExplainMore(err, i)}
                        disabled={aiState.loading}
                        style={{
                          padding: "8px 12px",
                          background: "rgba(14, 165, 233, 0.2)",
                          color: "#bae6fd",
                          border: "1px solid rgba(56, 189, 248, 0.45)",
                          borderRadius: "8px",
                          cursor: aiState.loading ? "not-allowed" : "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                          opacity: aiState.loading ? 0.8 : 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {aiState.loading && <span className="acqr-button-spinner" />}
                        {aiState.loading
                          ? "Thinking..."
                          : aiState.open
                            ? "Hide Explanation"
                            : "✨ Explain More"}
                      </button>
                    </div>

                    {aiState.open && (aiState.explanation || aiState.error) && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "10px",
                          borderRadius: "8px",
                          background: "rgba(2, 132, 199, 0.12)",
                          border: "1px solid rgba(56, 189, 248, 0.25)",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 6px 0",
                            color: "#bae6fd",
                            fontWeight: 700,
                            fontSize: "12px",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          AI Deep Explanation
                        </p>
                        {aiState.error ? (
                          <p style={{ margin: 0, color: "#fca5a5", fontSize: "13px" }}>
                            {aiState.error}
                          </p>
                        ) : (
                          <p
                            style={{
                              margin: 0,
                              color: "#e0f2fe",
                              fontSize: "13px",
                              lineHeight: 1.6,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {aiState.explanation}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )})}
          </>
        )}
      </div>
    </div>
  );
}

export default App;