import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function InteractiveTerminal({ code, runTrigger, onFinished }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  
  useEffect(() => {
    if (!terminalRef.current) return;
    
    // Initialize xterm
    const term = new Terminal({
      theme: {
        background: '#141210',
        foreground: '#cfc6b8',
        cursor: '#b8924a'
      },
      fontFamily: 'var(--font-mono)',
      fontSize: 13.5,
      cursorBlink: true,
      disableStdin: true
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // Connect WebSocket when runTrigger increments
  useEffect(() => {
    if (runTrigger === 0 || !code) return;
    
    const term = xtermRef.current;
    if (!term) return;
    
    term.clear();
    term.reset();
    term.write('Running...\r\n');
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const baseUrl = (import.meta.env.VITE_API_URL || "http://localhost:8000");
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/run-code';
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      term.options.disableStdin = false;
      ws.send(code);
    };
    
    ws.onmessage = (event) => {
      const text = event.data.replace(/\r?\n/g, '\r\n');
      term.write(text);
      if (text.includes('[Process exited]')) {
        term.options.disableStdin = true;
        if (onFinished) onFinished();
      }
    };
    
    ws.onclose = () => {
      term.options.disableStdin = true;
      if (onFinished) onFinished();
    };
    
    ws.onerror = () => {
      term.write('\r\n[WebSocket Error]\r\n');
      term.options.disableStdin = true;
      if (onFinished) onFinished();
    };
    
    let inputBuffer = '';
    const onDataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Local echo and line buffering for non-pty processes
        if (data === '\r') {
           term.write('\r\n');
           ws.send(inputBuffer + '\n');
           inputBuffer = '';
        } else if (data === '\x7F') {
           if (inputBuffer.length > 0) {
             inputBuffer = inputBuffer.slice(0, -1);
             term.write('\b \b');
           }
        } else {
           term.write(data);
           inputBuffer += data;
        }
      }
    });
    
    return () => {
      onDataDisposable.dispose();
      ws.close();
    };
  }, [runTrigger]);
  
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', padding: '16px' }}>
      <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
