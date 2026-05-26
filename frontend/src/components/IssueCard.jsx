import { useState, useEffect } from "react";

const SEVERITY = {
  error:   {
    border:  "border-l-rose-500",
    glow:    "rgba(244,63,94,0.15)",
    label:   "CODE BLOCKED 🛑",
    tone:    "Let's fix this blocking error first so Python can run your code!",
    headlineColor: "text-rose-400",
  },
  warning: {
    border:  "border-l-amber-500",
    glow:    "rgba(245,158,11,0.15)",
    label:   "LOGICAL HEADS-UP ⚠️",
    tone:    "Python can read this, but it might behave unexpectedly or crash later!",
    headlineColor: "text-amber-400",
  },
  info:    {
    border:  "border-l-sky-500",
    glow:    "rgba(56,189,248,0.15)",
    label:   "TIDY HINT 💡",
    tone:    "Your code runs fine! Here is a little tip to make it look professional.",
    headlineColor: "text-sky-400",
  },
};

// Map backend severity keys to standard ones
SEVERITY.high = SEVERITY.error;
SEVERITY.medium = SEVERITY.warning;
SEVERITY.low = SEVERITY.info;

// Mentorship Translation Dictionary (Task 1) - Resolves scary compiler jargon
const FRIENDLY_REWRITES = {
  "expected ':'": {
    eli5: "It looks like we missed a colon ':' here! In Python, a colon is like opening a door to tell Python that a block of instructions is starting.",
    why: "Lines starting with keywords like 'if', 'for', 'while', or 'def' are block headers and must end with a ':' so Python knows where the nested code starts.",
    check: "Check the end of this line and ensure it has a ':' character."
  },
  "unterminated string": {
    eli5: "We opened a text string with a quote mark but forgot to close it! It's like leaving a quote in a book open forever.",
    why: "Python sees an opening quote (' or \") and expects a matching quote on the same line to mark where the text ends. If it reaches the end of the line without finding it, it gets confused.",
    check: "Check this line and ensure your string has a matching closing quote (' or \")."
  },
  "is not defined": {
    eli5: "It seems Python hasn't been introduced to this name yet! It could be a tiny spelling mistake or a variable created in the wrong order.",
    why: "Python reads your code from top to bottom. If you try to use a variable or call a function before you've created it, Python doesn't know where to find it in its memory contact list.",
    check: "Check if the variable name is spelled exactly the same as where you created it (remember, Python is case-sensitive!) and make sure it is defined above this line."
  },
  "list index out of range": {
    eli5: "We tried to open a box in our list that doesn't exist! Remember, list boxes start counting at 0, not 1.",
    why: "If a list has 3 items, its boxes are labeled 0, 1, and 2. Attempting to look for box 3 (or higher) is outside the bounds of the list.",
    check: "Verify the length of your list and ensure the index you are accessing is strictly less than that length."
  },
  "division by zero": {
    eli5: "Whoops! We tried to divide by zero. In both mathematics and programming, dividing by nothing is a bit of a logical paradox!",
    why: "Since dividing any number by zero doesn't have a mathematically valid result, Python stops the program with an error rather than producing a wrong answer.",
    check: "Check the denominator in your calculation and ensure it is not zero before dividing."
  },
  "unused variable": {
    eli5: "We created a variable but haven't used it yet. The code will run perfectly, but it's a helpful hint to keep things tidy!",
    why: "Keeping unused variables can make code harder to read and occupies unnecessary space in Python's notes. If we don't need it, we can safely remove it.",
    check: "Double-check if you intended to use this variable in your logic, or clean it up if it's no longer needed."
  },
  "shadows built-in": {
    eli5: "We named a variable after a built-in Python keyword (like 'list' or 'str'). Our code runs, but it might block Python's default features later!",
    why: "If you name a list variable 'list', Python will use your variable instead of the built-in 'list()' helper function, which can cause unexpected crashes down the line.",
    check: "Rename this variable to something descriptive like 'my_list' or 'items' to avoid naming clashes."
  },
  "indentationerror": {
    eli5: "It looks like we have a spacing mismatch! Python is extremely particular about alignment at the beginning of each line.",
    why: "Python uses spacing (4 spaces is standard) instead of curly braces to group commands. A sudden change in alignment confuses Python about which block owns that command.",
    check: "Review the spaces at the start of this line and align it precisely with the lines surrounding it."
  },
  "unexpected indent": {
    eli5: "A line is pushed in further than it should be! Spacing is how Python understands block hierarchy.",
    why: "Python uses indentation levels to determine blocks. If a line has unexpected spaces, Python thinks a block is starting, but there's no header keyword.",
    check: "Use your Backspace key to align this line back in place with the rest of the block."
  },
  "invalid syntax": {
    eli5: "Python ran into something it didn't expect! It could be a tiny typo or a misplaced symbol.",
    why: "Python parses tokens strictly. When a character doesn't follow standard syntax paths, it reports invalid syntax.",
    check: "Scan the line for extra symbols, misspelled keywords, or unmatched brackets."
  }
};

const findFriendlyRewrite = (errorMsg) => {
  if (!errorMsg) return null;
  const msg = errorMsg.toLowerCase();
  for (const [key, rewrite] of Object.entries(FRIENDLY_REWRITES)) {
    if (msg.includes(key)) return rewrite;
  }
  return null;
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
  const [checkedSteps, setCheckedSteps] = useState({});

  const sev         = SEVERITY[err.severity || "error"] || SEVERITY.error;
  const errorMsg    = compress(err.error);
  const suggestion  = err.suggestion && !isGeneric(err.suggestion) ? compress(err.suggestion) : null;
  const hasFix      = err.fix?.type === "replace_line" || err.fix?.changes?.length > 0;

  // Resolve simplified mentorship wording (Task 1 & Task 4)
  const rewrite = findFriendlyRewrite(err.error);
  const eli5Explanation = err.explanation || (rewrite ? rewrite.eli5 : null) || compress(err.explanation);
  const whyItHappened = err.why_it_happened || (rewrite ? rewrite.why : null);
  const howToAvoid = err.how_to_avoid || (rewrite ? rewrite.check : null);

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

  return (
    <div
      id={`issue-card-${err.flatIndex}`}
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
        justFixed ? "shadow-[0_0_0_1px_rgba(16,185,129,0.4)] scale-[0.98] opacity-90" : "",
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
        {/* Custom Severity Tone Tags (Task 2) */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <span className={`font-label font-bold text-[9px] tracking-wider uppercase px-2 py-0.5 rounded border ${sev.headlineColor} bg-white/[0.02]`}
                style={{ borderColor: sev.border.replace('border-l-', 'border-').replace('border-rose-500', 'rgba(244,63,94,0.2)').replace('border-amber-500', 'rgba(245,158,11,0.2)').replace('border-sky-500', 'rgba(56,189,248,0.2)'), textShadow: `0 0 8px ${sev.glow}` }}>
            {sev.label}
          </span>
          {err.line && (
            <span className="font-mono text-[10px] text-slate-500 font-bold">
              LINE {err.line}
            </span>
          )}
        </div>

        <p className="text-[15px] font-semibold text-slate-200 leading-snug tracking-wide">
          {errorMsg}
        </p>

        {/* Reassuring Severity Tone Explanations (Task 2) */}
        <p className="text-[11.5px] font-medium text-slate-400/70 italic mt-1 leading-relaxed">
          {sev.tone}
        </p>
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
              background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
              boxShadow: "0 4px 14px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            Fix this for me ⚡
          </button>
        )}
        {justFixed && (
          <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                          bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[13px] transition-all duration-300 animate-pulse">
            <span className="text-lg">✨</span> Sorted!
          </div>
        )}

        {(eli5Explanation || whyItHappened || howToAvoid || suggestion || err.mental_model) && (
          <button
            onClick={e => { e.stopPropagation(); setLearnOpen(v => !v); }}
            className="flex-shrink-0 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-slate-400
                       hover:text-white bg-white/5 hover:bg-white/10 transition-all duration-200"
          >
            {learnOpen ? "Close" : "Why? 🤔"}
          </button>
        )}
      </div>

      {/* ── Collapsible "Why?" Mentorship Drawer (Task 4) ──────────────────── */}
      {learnOpen && (
        <div
          className="relative border-t border-white/5 px-5 pt-5 pb-6 flex flex-col gap-5.5 animate-fade-in"
          onClick={e => e.stopPropagation()}
          style={{ background: "rgba(4,8,20,0.4)" }}
        >
          {/* Segment 1: The ELI5 Explanation */}
          {eli5Explanation && (
            <div>
              <p className="font-label text-[10px] font-bold text-[#a2a1a8] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <span>🗣️</span> ELI5 Explanation
              </p>
              <p className="text-[13px] text-slate-300 leading-relaxed font-normal">
                {eli5Explanation}
              </p>
            </div>
          )}

          {/* Segment 2: Why this happens */}
          {whyItHappened && (
            <div>
              <p className="font-label text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <span>🧠</span> Why this happens
              </p>
              <p className="text-[13px] text-slate-300 leading-relaxed font-normal">
                {whyItHappened}
              </p>
            </div>
          )}

          {/* Segment 3: How to avoid this */}
          {howToAvoid && (
            <div>
              <p className="font-label text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <span>🌟</span> How to avoid this
              </p>
              <p className="text-[13px] text-slate-300 leading-relaxed font-normal">
                {howToAvoid}
              </p>
            </div>
          )}

          {/* Segment 4: Mental Model (Analogy + ASCII) */}
          {err.mental_model && (
            <div className="rounded-xl border border-white/5 p-4 bg-white/[0.02] backdrop-blur-md">
              <p className="font-label text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <span>🧠</span> Mental Model: {err.mental_model.analogy_title}
              </p>
              <p className="text-[13px] text-slate-300 leading-relaxed mb-3 italic">
                "{err.mental_model.analogy_body}"
              </p>
              {err.mental_model.visual_ascii && (
                <div className="relative rounded-lg overflow-x-auto bg-black/40 border border-white/5 p-3.5">
                  <pre className="text-[11px] font-mono text-emerald-400 leading-relaxed whitespace-pre font-semibold">
                    {err.mental_model.visual_ascii}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Segment 5: Interactive Scaffolding Clues */}
          {err.remediation?.interactive_scaffolding && (
            <div className="mt-1">
              <p className="font-label text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <span>🛠️</span> Interactive Clues
              </p>
              <div className="flex flex-col gap-2.5">
                {err.remediation.interactive_scaffolding.map((step, sIdx) => {
                  const isChecked = !!checkedSteps[sIdx];
                  return (
                    <label
                      key={sIdx}
                      onClick={(e) => e.stopPropagation()}
                      className={`flex items-start gap-3 cursor-pointer group text-[13px] transition-all duration-200 ${
                        isChecked ? "text-slate-500 line-through opacity-70" : "text-slate-300 hover:text-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setCheckedSteps(prev => ({ ...prev, [sIdx]: e.target.checked }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 w-4 h-4 rounded border-white/10 bg-slate-800 text-indigo-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="leading-snug select-none group-hover:translate-x-0.5 transition-transform duration-200">
                        {step}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Segment 6: Before / After Diffs */}
          {err.remediation?.bad_code && err.remediation?.good_code && (
            <div className="mt-1">
              <p className="font-label text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-2.5">
                ⚡ Code Comparison
              </p>
              <div className="grid grid-cols-1 gap-3.5">
                {/* Bad Code */}
                <div className="rounded-xl bg-rose-500/5 border border-rose-500/20 p-4 shadow-inner">
                  <p className="font-label text-[9px] font-black text-[#f43f5e] uppercase tracking-widest mb-2">Needs Fix</p>
                  <pre className="text-[11px] font-mono text-slate-300 whitespace-pre overflow-x-auto leading-relaxed">
                    {err.remediation.bad_code}
                  </pre>
                </div>
                {/* Good Code */}
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 shadow-inner">
                  <p className="font-label text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Correct Approach</p>
                  <pre className="text-[11px] font-mono text-emerald-300 whitespace-pre overflow-x-auto leading-relaxed">
                    {err.remediation.good_code}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Fallback to simple suggestion when rich BPEID is absent */}
          {!err.mental_model && !rewrite && suggestion && (
            <div>
              <p className="font-label text-[10px] font-bold text-[#5e5ce6] uppercase tracking-widest mb-1.5">
                The Fix
              </p>
              <p className="text-[13px] text-slate-300 leading-relaxed font-medium">{suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
