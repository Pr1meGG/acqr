import { useState } from "react";
import DiffViewer from "./DiffViewer";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SEVERITY = {
  error:   { border: "border-l-red-500",    icon: "❌", lineColor: "text-red-400",    label: "Error" },
  warning: { border: "border-l-yellow-500", icon: "⚠️", lineColor: "text-yellow-400", label: "Warning" },
  info:    { border: "border-l-blue-500",   icon: "ℹ️", lineColor: "text-blue-400",   label: "Info" },
};

function compressText(msg) {
  if (!msg) return "";
  let s = msg
    .replace(/^The\s+['"]?.*?['"]?\s+statement\s+on\s+line\s+\d+\s+(is\s+)?/i, "")
    .replace(/^Line\s+\d+:\s*/i, "")
    .replace(/\s+statement\s+needs\s+/i, " needs ")
    .replace(/\.\s*$/, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isGeneric(text) {
  if (!text) return true;
  const l = text.toLowerCase();
  return l.includes("flake8") || l.includes("use ide") || l.includes("pylint") || l.includes("use a linter");
}

export default function IssueCard({ err, onApplyFix, onLineClick, isActive }) {
  const [expanded,    setExpanded]    = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [justFixed,   setJustFixed]   = useState(false);

  const sev = SEVERITY[err.severity || "error"] || SEVERITY.error;

  const errorMsg   = compressText(err.error);
  const shortExp   = err.short_explanation || compressText(err.explanation);
  const suggestion = err.suggestion && !isGeneric(err.suggestion) ? compressText(err.suggestion) : null;
  const hasFix     = err.fix?.changes?.length > 0;

  const handleApply = (e) => {
    e.stopPropagation();
    onApplyFix(err.fix.changes);
    setJustFixed(true);
    setTimeout(() => setJustFixed(false), 2500);
  };

  const handleFeedback = async (wasCorrect) => {
    if (feedbackSent || !err.issue_key) return;
    try {
      await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue_key: err.issue_key, was_correct: wasCorrect }),
      });
      setFeedbackSent(true);
    } catch (e) { console.error(e); }
  };

  return (
    <div
      onClick={onLineClick}
      className={[
        "glass p-4 rounded-xl border-l-4 transition-all duration-200 cursor-pointer overflow-hidden animate-slide-in hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:bg-[#0d1b2e]",
        sev.border,
        isActive ? "ring-2 ring-primary/50" : "hover:bg-white/5",
        justFixed ? "ring-2 ring-success/50" : ""
      ].join(" ")}
    >
      {/* ── Header: Icon, Line, Error ────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5">{sev.icon}</span>
        <div className="flex-1">
          {err.line && (
            <span className={`text-sm font-semibold font-mono mb-1 block ${sev.lineColor}`}>
              Line {err.line}
            </span>
          )}
          <p className="text-base font-medium text-text leading-snug">
            {errorMsg}
          </p>
          {justFixed && (
            <p className="mt-2 text-sm text-success font-medium">✓ Fix applied successfully</p>
          )}
        </div>
      </div>

      {/* ── Body: What went wrong & Fix ──────────────────────────────────── */}
      <div className="mt-4 flex flex-col gap-4">
        {shortExp && (
          <div>
            <p className="text-sm font-bold text-text-muted mb-1">
              👉 What went wrong:
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {shortExp}
            </p>
          </div>
        )}

        {suggestion && (
          <div>
            <p className="text-sm font-bold text-text-muted mb-1">
              💡 Fix:
            </p>
            <p className="text-sm text-slate-300 leading-relaxed italic">
              {suggestion}
            </p>
          </div>
        )}

        {hasFix && !justFixed && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <button
              onClick={handleApply}
              className="btn-primary w-full justify-center transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_10px_rgba(59,130,246,0.3)]"
            >
              Fix automatically
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
