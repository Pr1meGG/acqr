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

  // Fake complexity score (we'll replace later with real Radon)
  const complexityScore = result ? Math.min(result.errors.length * 2, 10) : 0;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        background: "linear-gradient(135deg, #0f172a, #020617)",
        color: "white",
      }}
    >
      {/* LEFT - EDITOR */}
      <div style={{ flex: 1, padding: "20px" }}>
        <h1
          style={{
            fontSize: "28px",
            marginBottom: "10px",
            color: "#38bdf8",
          }}
        >
          ACQR 🚀
        </h1>

        <Editor
          height="80%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || "")}
        />

        <button
          onClick={analyzeCode}
          style={{
            marginTop: "15px",
            padding: "10px 20px",
            background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
            border: "none",
            borderRadius: "10px",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {loading ? "Analyzing..." : "Analyze Code"}
        </button>
      </div>

      {/* RIGHT - GLASS PANEL */}
      <div
        style={{
          width: "38%",
          padding: "20px",
          backdropFilter: "blur(20px)",
          background: "rgba(255, 255, 255, 0.05)",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          overflowY: "auto",
        }}
      >
        <h2 style={{ marginBottom: "10px" }}>AI Insights 🤖</h2>

        {!result && (
          <p style={{ color: "#9ca3af" }}>
            Run analysis to see insights...
          </p>
        )}

        {result && (
          <>
            {/* COMPLEXITY */}
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <h3>⚡ Complexity Score</h3>
              <p style={{ fontSize: "20px", color: "#38bdf8" }}>
                {complexityScore} / 10
              </p>
            </div>

            {/* BEGINNER FRIENDLY */}
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <h3>📘 Beginner-Friendly Explanation</h3>
              <p style={{ color: "#94a3b8" }}>
                These errors indicate that your code has some missing elements or incorrect usage.
                Try fixing undefined variables and adding proper documentation.
              </p>
            </div>

            {/* ERRORS */}
            {result.errors.map((err, i) => (
              <div
                key={i}
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  marginBottom: "10px",
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                <p>
                  <b>Line:</b> {err.line}
                </p>

                <p style={{ color: "#f87171", fontWeight: "bold" }}>
                  ❌ {err.message}
                </p>

                <p style={{ color: "#38bdf8" }}>
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