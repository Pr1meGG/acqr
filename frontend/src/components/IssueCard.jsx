import React, { useState } from 'react';

function escapeHtml(s) {
  if (!s) return "";
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

export default function IssueCard({ issue, onFix, onShowOut }) {
    const [expanded, setExpanded] = useState(false);
    
    if (!issue) return null;

    const hasFix = !!issue.fix?.changes?.[0]?.replacement;
    const cluesHtml = issue.remediation?.interactive_scaffolding || (issue.how_to_avoid ? [issue.how_to_avoid] : []);

    const isHack = issue.severity === "low";

    if (isHack && !expanded) {
        return (
            <div style={{ marginTop: '1rem', padding: '12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--well-2)' }}>
                <button 
                    className="btn btn-ghost" 
                    style={{ width: '100%', textAlign: 'left', color: '#b8924a', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onClick={() => setExpanded(true)}
                >
                    <span>✨</span>
                    <span>An optimization hack is available! Click to view.</span>
                </button>
            </div>
        );
    }

    return (
        <div>
            <p className="issue-kicker">Line {issue.line || 1} · {issue.severity || 'Syntax'}</p>
            <h2 className="issue-title">{issue.error || "Error"}</h2>
            <p className="issue-body">{issue.explanation || "An error occurred preventing execution."}</p>
            
            <div className="toolbar">
                {hasFix && (
                    <button className="btn btn-fix" type="button" onClick={onFix}>
                        Apply fix
                    </button>
                )}
                <button className="btn btn-ghost" type="button" onClick={onShowOut}>
                    Show terminal
                </button>
            </div>

            {issue.explanation && (
                <section className="section s-explain">
                    <h2>What this line is doing</h2>
                    <p>{issue.explanation}</p>
                </section>
            )}

            {(issue.why_it_happened || issue.root_cause) && (
                <section className="section s-why">
                    <h2>Why it fails</h2>
                    <p>{issue.why_it_happened || issue.root_cause}</p>
                </section>
            )}

            {(issue.how_to_avoid || issue.suggestion) && (
                <section className="section s-avoid">
                    <h2>How to fix it</h2>
                    <p>{issue.how_to_avoid || issue.suggestion}</p>
                    {issue.mental_model?.analogy_body && (
                        <div className="model">
                            <p>{issue.mental_model.analogy_body}</p>
                            {issue.mental_model.visual_ascii && (
                                <pre className="diagram">{issue.mental_model.visual_ascii}</pre>
                            )}
                        </div>
                    )}
                </section>
            )}

            {cluesHtml.length > 0 && (
                <section className="section s-clues">
                    <h2>Check these</h2>
                    <ul className="clues">
                        {cluesHtml.map((c, i) => (
                            <li key={i}><span className="tick" aria-hidden="true"></span><span>{c}</span></li>
                        ))}
                    </ul>
                </section>
            )}

            {issue.remediation?.bad_code && issue.remediation?.good_code && (
                <section className="section s-compare">
                    <h2>Side by side</h2>
                    <div className="compare">
                        <div className="snip bad">
                            <div className="snip-label">Needs Fix</div>
                            <pre>{escapeHtml(issue.remediation.bad_code)}</pre>
                        </div>
                        <div className="snip good">
                            <div className="snip-label">Correct</div>
                            <pre>{escapeHtml(issue.remediation.good_code)}</pre>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
