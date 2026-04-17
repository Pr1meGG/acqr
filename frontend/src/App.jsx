import { useState } from "react";
import Editor from "@monaco-editor/react";

function App() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzeCode = async () => {
    if (!code.trim()) {
      alert("Please enter some code first!");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Error connecting to backend");
    }

    setLoading(false);
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
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbersMinChars: 3,
            scrollBeyondLastLine: false,
          }}
        />

        <button
          onClick={analyzeCode}
          style={{
            alignSelf: "flex-start",
            padding: "10px 16px",
            background: "#2563eb",
            border: "1px solid rgba(147, 197, 253, 0.35)",
            borderRadius: "8px",
            color: "#eff6ff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
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
              <p style={{ margin: 0, color: "#94a3b8" }}>No errors found.</p>
            )}

            {(result.errors || []).map((err, i) => (
              <div
                key={i}
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  marginBottom: "10px",
                  background: "rgba(30, 41, 59, 0.38)",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                }}
              >
                <p style={{ margin: "0 0 8px 0", color: "#cbd5e1", fontSize: "13px" }}>
                  Line {err.line}
                </p>

                <p style={{ margin: "0 0 8px 0", color: "#f87171", fontWeight: 600 }}>
                  {err.message}
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