export default function DiffViewer({ fix }) {
  if (!fix?.changes?.length) return null;

  return (
    <div className="rounded border border-border overflow-hidden text-xs font-mono">
      {fix.changes.map((change, idx) => (
        <div key={idx}>
          <div className="bg-surface-2 px-2 py-0.5 text-[9px] font-label text-text-muted border-b border-border/50">
            L{change.line_start}{change.line_end !== change.line_start ? `–${change.line_end}` : ""}
          </div>
          <pre className="m-0 px-2 py-1.5 bg-success-glow flex gap-2 whitespace-pre-wrap break-all">
            <span className="text-success font-bold select-none">+</span>
            <code className="text-slate-200">{change.replacement}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
