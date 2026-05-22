import { useState, useEffect } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SEVERITY = {
  error:   {
    border:  "border-l-[#ff3b30]",
    glow:    "rgba(255,59,48,0.25)",
    labels:  ["BROKE THE FLOW", "HOLD UP", "SYNTAX HICCUP", "QUICK FIX NEEDED", "NEEDS A LOOK"],
    headlineColor: "text-[#ff453a]",
  },
  warning: {
    border:  "border-l-[#ff9f0a]",
    glow:    "rgba(255,159,10,0.2)",
    labels:  ["NEEDS ATTENTION", "HEADS UP", "MIGHT BE BUGGY", "SLIGHT ISSUE"],
    headlineColor: "text-[#ff9f0a]",
  },
  info:    {
    border:  "border-l-[#0a84ff]",
    glow:    "rgba(10,132,255,0.2)",
    labels:  ["PRO TIP", "SUGGESTION", "GOOD TO KNOW", "IDEA"],
    headlineColor: "text-[#5e5ce6]",
  },
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

export default function IssueCard({ err, onApplyFix, onRemoveIssue, onLineClick, onHover, isActive }) {
  const [learnOpen, setLearnOpen] = useState(false);
  const [justFixed, setJustFixed] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const sev         = SEVERITY[err.severity || "error"] || SEVERITY.error;
  const errorMsg    = compress(err.error);
  const explanation = err.short_explanation || compress(err.explanation);
  const suggestion  = err.suggestion && !isGeneric(err.suggestion) ? compress(err.suggestion) : null;
  const fullExp     = err.explanation && err.explanation !== err.short_explanation ? err.explanation : null;
  const hasFix      = err.fix?.type === "replace_line" || err.fix?.changes?.length > 0;

  const handleApply = (e) => {
    e.stopPropagation();
    setJustFixed(true); // Triggers button glow and sorted state
    
    // Step 1: Wait a short moment to show the success state on the button
    setTimeout(() => {
      // Step 2: Trigger code update and console logs in App
      onApplyFix(err.fix, err.flatIndex, err.error);
    }, 400);

    // Step 3: Start fading the card out
    setTimeout(() => {
      setIsLeaving(true);
    }, 1200);
  };

  // Step 4: Actually remove the issue from the list after animation finishes
  useEffect(() => {
    if (isLeaving && onRemoveIssue) {
      const t = setTimeout(() => onRemoveIssue(err.flatIndex), 300);
      return () => clearTimeout(t);
    }
  }, [isLeaving, err.flatIndex, onRemoveIssue]);

  const lineStr = err.line ? `LINE ${err.line}` : "ISSUE";
  // Pick a stable label based on error string length so it doesn't flicker on re-renders
  const labelList = sev.labels || ["ISSUE"];
  const stableIndex = (errorMsg.length + (err.line || 0)) % labelList.length;
  const displayLabel = labelList[stableIndex];

  return (
    <div
      onClick={onLineClick}
      onMouseEnter={() => onHover && onHover(err.flatIndex)}
      onMouseLeave={() => onHover && onHover(-1)}
      className={[
        "relative rounded-2xl border-l-[4px] cursor-pointer overflow-hidden",
        "transition-all duration-300",
        isLeaving ? "animate-slide-out-right opacity-0" : "animate-slide-in-right",
        sev.border,
        isActive
          ? "scale-[1.01] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_12px_40px_rgba(0,0,0,0.6)] z-10"
          : "shadow-card hover:shadow-card-hover",
        justFixed ? "shadow-[0_0_0_1px_rgba(16,185,129,0.4)]" : "",
      ].join(" ")}
      style={{
        background: `linear-gradient(145deg, rgba(16,20,30,0.95) 0%, rgba(10,14,24,0.98) 100%)`,
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Ambient glow behind card contents */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: `radial-gradient(circle at 0% 0%, ${sev.glow}, transparent 70%)`
        }}
      />

      {/* ── Headline row ──────────────────────────────────────────────────── */}
      <div className="relative px-5 pt-5 pb-3">
        <h3 className={`font-black text-lg tracking-wide uppercase mb-2 ${sev.headlineColor}`}
            style={{ textShadow: `0 0 16px ${sev.glow}` }}>
          {lineStr} {displayLabel}
        </h3>
        <p className="text-[15px] font-medium text-slate-200 leading-snug">
          {errorMsg}
        </p>

        {/* 1-line explanation */}
        {explanation && (
          <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed">
            {explanation}
          </p>
        )}
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="relative flex items-center gap-3 px-5 pb-5 mt-2">
        {hasFix && !justFixed && (
          <button
            onClick={handleApply}
            className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-white
                       transition-all duration-300 transform hover:scale-[1.03]
                       flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #007aff 0%, #5e5ce6 100%)",
              boxShadow: "0 4px 14px rgba(94,92,230,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            Fix this for me ⚡
          </button>
        )}
        {justFixed && (
          <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                          bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[13px]">
            <span className="text-lg">✨</span> Sorted!
          </div>
        )}

        {(suggestion || fullExp) && (
          <button
            onClick={e => { e.stopPropagation(); setLearnOpen(v => !v); }}
            className="flex-shrink-0 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-slate-400
                       hover:text-white bg-white/5 hover:bg-white/10 transition-all duration-200"
          >
            {learnOpen ? "Close" : "Why? 🤔"}
          </button>
        )}
      </div>

      {/* ── Collapsible "Why?" ─────────────────────────────────────────── */}
      {learnOpen && (
        <div
          className="relative border-t border-white/5 px-5 pt-4 pb-5 flex flex-col gap-4 animate-fade-in"
          onClick={e => e.stopPropagation()}
          style={{ background: "rgba(0,0,0,0.2)" }}
        >
          {suggestion && (
            <div>
              <p className="text-[10px] font-bold text-[#5e5ce6] uppercase tracking-widest mb-1.5">
                The Fix
              </p>
              <p className="text-[13px] text-slate-300 leading-relaxed font-medium">{suggestion}</p>
            </div>
          )}
          {fullExp && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                The Details
              </p>
              <p className="text-[13px] text-slate-400 leading-relaxed">{fullExp}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
