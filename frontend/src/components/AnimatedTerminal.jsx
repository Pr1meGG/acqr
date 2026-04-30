import { useEffect, useRef, useState } from "react";

export default function AnimatedTerminal({ execution }) {
  const [lines, setLines] = useState([]);
  const terminalRef = useRef(null);

  useEffect(() => {
    if (!execution) return;
    const allLines = [
      ...(execution.output ? execution.output.split("\n") : []),
      ...(execution.error  ? execution.error.split("\n").map(l => `\x00${l}`) : []),
    ].filter(l => l !== "");

    setLines([]);
    let i = 0;
    const interval = setInterval(() => {
      if (i < allLines.length) {
        setLines(p => [...p, allLines[i++]]);
      } else {
        clearInterval(interval);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [execution]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [lines]);

  return (
    <div ref={terminalRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs scroll-smooth">
      {!execution && (
        <p className="text-text-muted italic">Run analysis to see output...</p>
      )}
      {(Array.isArray(lines) ? lines : []).map((line, idx) => {
        if (line === undefined || line === null) line = "";
        const isErr = typeof line === "string" && line.startsWith("\x00");
        const text  = isErr ? line.slice(1) : String(line);
        return (
          <div key={idx} className="flex gap-2 mb-0.5">
            <span className={isErr ? "text-red-400" : "text-green-500 font-bold"}>
              {isErr ? ">" : ">"}
            </span>
            <span className={isErr ? "text-red-400/90" : "text-green-400"}>{text}</span>
          </div>
        );
      })}
    </div>
  );
}
