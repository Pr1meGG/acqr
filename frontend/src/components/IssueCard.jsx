import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SEVERITY = {
  error:   { border: "border-l-red-500",    icon: "❌", badge: "bg-red-500/10 text-red-400" },
  warning: { border: "border-l-yellow-400", icon: "⚠️", badge: "bg-yellow-500/10 text-yellow-400" },
  info:    { border: "border-l-blue-400",   icon: "ℹ️",  badge: "bg-blue-500/10 text-blue-400" },
};

function compress(msg) {
  if (!msg) return "";
  return msg
    .replace(/^The\s+['""]?.*?['""]?\s+statement\s+on\s+line\s+\d+\s+(is\s+)?/i, "")
    .replace(/^Line\s+\d+:\s*/i, "")
    .replace(/\s+statement\s+needs\s+/i, " needs ")
    .replace(/\.\s*$/, "")
    .replace(/^./, c => c.toUpperCase());
}

function isGeneric(t) {
  if (!t) return true;
  const l = t.toLowerCase();
  return l.includes("flake8") || l.includes("use ide") || l.includes("pylint") || l.includes("use a linter");
}

export default function IssueCard({ err, onApplyFix, onLineClick, isActive }) {
  const [learnOpen, setLearnOpen] = useState(false);
  const [justFixed, setJustFixed] = useState(false);

  const sev        = SEVERITY[err.severity || "error"] || SEVERITY.error;
  const errorMsg   = compress(err.error);
  const explanation = err.short_explanation || compress(err.explanation);
  const suggestion = err.suggestion && !isGeneric(err.suggestion) ? compress(err.suggestion) : null;
  const fullExp    = err.explanation && err.explanation !== err.short_explanation ? err.explanation : null;
  const hasFix     = err.fix?.type === "replace_line" || err.fix?.changes?.length > 0;

  const handleApply = (e) => {
    e.stopPropagation();
    onApplyFix(err.fix);
    setJustFixed(true);
    setTimeout(() => setJustFixed(false), 2500);
  };

  return (
    <div
      onClick={onLineClick}
      className={[
        "rounded-xl border-l-4 bg-[#0b1626] transition-all duration-200 cursor-pointer overflow-hidden",
        "animate-slide-in-right hover:-translate-y-0.5",
        "hover:bg-[#0d1e35] hover:shadow-[0_4px_24px_rgba(0,0,0,0.35)]",
        sev.border,
        isActive  ? "ring-2 ring-primary/40 bg-[#0d1e35]" : "",
        justFixed ? "ring-2 ring-success/40" : "",
      ].join(" ")}
    >
      {/* ── Title row ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <span className="text-base leading-none mt-0.5 flex-shrink-0">{sev.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-100 leading-snug">
            Line {err.line ?? "?"}&ensp;—&ensp;
            <span className="font-normal text-slate-300">{errorMsg}</span>
          </p>

          {/* 1-line explanation */}
          {explanation && (
            <p className="mt-1.5 text-[13px] text-slate-400 leading-relaxed">
              {explanation}
            </p>
          )}
        </div>
      </div>

      {/* ── Action row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pb-4">
        {hasFix && !justFixed && (
          <button
            onClick={handleApply}
            className="flex-1 btn-primary py-2 text-[13px] font-semibold justify-center
                       hover:scale-[1.02] hover:shadow-[0_0_14px_rgba(59,130,246,0.45)]
                       transition-all duration-200"
          >
            Fix automatically
          </button>
        )}

        {justFixed && (
          <span className="text-sm text-success font-medium animate-fade-in">
            ✓ Fixed!
          </span>
        )}

        {/* Learn why — collapsible */}
        {(suggestion || fullExp) && (
          <button
            onClick={e => { e.stopPropagation(); setLearnOpen(v => !v); }}
            className="text-[12px] text-text-muted hover:text-slate-300 transition-colors px-2 py-1.5
                       border border-border rounded-lg hover:border-border-2 flex-shrink-0"
          >
            {learnOpen ? "Hide ▲" : "Learn why ▼"}
          </button>
        )}
      </div>

      {/* ── Collapsible detail ─────────────────────────────────────────── */}
      {learnOpen && (
        <div
          className="px-4 pb-4 border-t border-[#1a2840] pt-3 flex flex-col gap-3 animate-fade-in"
          onClick={e => e.stopPropagation()}
        >
          {suggestion && (
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">
                Suggested fix
              </p>
              <p className="text-[13px] text-slate-300 leading-relaxed italic">{suggestion}</p>
            </div>
          )}
          {fullExp && (
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">
                Explanation
              </p>
              <p className="text-[13px] text-slate-400 leading-relaxed">{fullExp}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
