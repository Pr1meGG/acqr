import { useEffect, useRef, useState, useMemo } from "react";

export default function AnimatedTerminal({ execution }) {
  const [lines, setLines] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const terminalRef = useRef(null);

  const allLines = useMemo(() => {
    if (!execution) return [];
    return [
      ...(execution.output ? execution.output.split("\n") : []),
      ...(execution.error  ? execution.error.split("\n").map(l => `\x00${l}`) : []),
    ].filter(l => l !== "");
  }, [execution]);

  useEffect(() => {
    if (!execution) {
      setLines([]);
      setIsTyping(false);
      return;
    }
    
    setIsTyping(true);
    const interval = setInterval(() => {
      setLines(prev => {
        // If we are fully caught up
        if (prev.length >= allLines.length) {
          setIsTyping(false);
          clearInterval(interval);
          return prev;
        }
        
        // If prefix doesn't match, we restarted a new analysis
        if (prev.length > 0 && prev[0] !== allLines[0]) {
          return [];
        }
        
        // Append the next line
        return [...prev, allLines[prev.length]];
      });
    }, 40);

    return () => clearInterval(interval);
  }, [allLines, execution]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div ref={terminalRef} className="flex-1 overflow-y-auto px-5 py-4 font-mono text-[14px] scroll-smooth tracking-wide"
         style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      {!execution && (
        <p className="text-slate-500 italic flex items-center">
          <span className="text-emerald-500 mr-3 opacity-80">➜</span> Waiting for execution...
          <span className="animate-pulse bg-slate-500 w-2 h-4 inline-block ml-1 opacity-70"></span>
        </p>
      )}
      {lines.map((line, idx) => {
        if (line === undefined || line === null) line = "";
        const isErr = typeof line === "string" && line.startsWith("\x00");
        const text  = isErr ? line.slice(1) : String(line);
        const isLast = idx === lines.length - 1;
        
        return (
          <div key={idx} className="flex gap-3 mb-2.5 leading-relaxed">
            <span className={isErr ? "text-rose-500 font-bold opacity-90 mt-0.5" : "text-emerald-500 font-bold opacity-80 mt-0.5"}>
              {isErr ? "✖" : "➜"}
            </span>
            <span className={isErr ? "text-rose-400 font-medium" : "text-emerald-400 font-medium"}>
              {text}
              {isLast && isTyping && (
                <span className="animate-pulse bg-emerald-400 w-2 h-[1em] inline-block ml-1.5 align-middle"></span>
              )}
            </span>
          </div>
        );
      })}
      {execution && !isTyping && (
        <div className="flex gap-3 mt-3">
           <span className="text-emerald-500 font-bold opacity-80">➜</span>
           <span className="animate-pulse bg-emerald-500 w-2 h-[1em] inline-block mt-1 align-middle opacity-80"></span>
        </div>
      )}
    </div>
  );
}
