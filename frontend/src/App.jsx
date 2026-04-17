import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
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
      .map((err) => Number(err?.line))
      .filter((line) => Number.isInteger(line) && line >= 1 && line <= maxLine)
      .map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: "acqr-error-line",
          inlineClassName: "acqr-error-underline",
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
    } catch (err) {
      console.error(err);
      setRequestError("Unable to analyze code right now. Please try again.");
      alert("Error connecting to backend");
    } finally {
      setLoading(false);
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
        <h2
          style={{
            margin: "0 0 14px 0",
            fontSize: "17px",
            fontWeight: 600,
            color: "#f8fafc",
          }}
        >
          Results
        </h2>

        {!result && (
          <p style={{ color: "#94a3b8", margin: 0 }}>
            Run analysis to see errors.
          </p>
        )}

        {result && (
          <>
            {(!result.errors || result.errors.length === 0) && (
              <p style={{ margin: 0, color: "#94a3b8" }}>
                No issues found. Your code looks clean!
              </p>
            )}

            {(result.errors || []).map((err, i) => (
              <div
                key={i}
                className="acqr-error-card"
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  marginBottom: "12px",
                  background: "rgba(30, 41, 59, 0.38)",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                  boxShadow: "0 4px 14px rgba(2, 6, 23, 0.22)",
                }}
              >
                <p style={{ margin: "0 0 8px 0", color: "#cbd5e1", fontSize: "13px" }}>
                  📍 Line {err.line}
                </p>

                <p style={{ margin: "0 0 8px 0", color: "#f87171", fontWeight: 600 }}>
                  ❌ {err.message}
                </p>

                <p style={{ margin: 0, color: "#60a5fa" }}>
                  {err.explanation}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default App;