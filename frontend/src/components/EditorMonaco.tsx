// frontend/src/components/EditorMonaco.tsx
import { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { API_URL } from "../config";
import "./Editor.css";

// REDUX IMPORTS
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../store/store";
import { setRoomId, setStatus } from "../store/slices/roomSlice";


type Props = {
  roomId: string;
  onLeave: () => void;
};

export default function EditorMonaco({ roomId, onLeave }: Props) {
  // REDUX HOOKS
  const dispatch = useDispatch<AppDispatch>();
  const status = useSelector((s: RootState) => s.room.status);

  // Local UI toast
  const [toast, setToast] = useState<string | null>(null);

  // WebSocket / Monaco refs
  const wsRef = useRef<WebSocket | null>(null);
  const skipRemoteRef = useRef(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const providerRef = useRef<monaco.IDisposable | null>(null);
  const initialCodeRef = useRef<string | null>(null);

  const shareUrl = `${window.location.origin}/room/${roomId}`;
  const idWidth = `${Math.min(60, Math.max(20, roomId.length))}ch`;

  // ===== Toast auto hide =====
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // ===== WebSocket connection =====
  useEffect(() => {
    // Update Redux state
    dispatch(setRoomId(roomId));
    dispatch(setStatus("connecting"));

    connectWS(roomId);

    return () => {
      wsRef.current?.close();
      providerRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function connectWS(id: string) {
    wsRef.current?.close();
    wsRef.current = null;

    const wsProto = API_URL.startsWith("https") ? "wss" : "ws";
    const base = API_URL.replace(/^https?/, wsProto);
    const ws = new WebSocket(`${base}/ws/${id}`);

    wsRef.current = ws;

    ws.onopen = () => dispatch(setStatus("connected"));
    ws.onclose = () => dispatch(setStatus("closed"));
    ws.onerror = console.error;

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        // INITIAL STATE
        if (msg.type === "initial_state") {
          skipRemoteRef.current = true;

          if (editorRef.current) {
            editorRef.current.setValue(msg.code ?? "");
            editorRef.current.setPosition({ lineNumber: 1, column: 1 });
            setTimeout(() => (skipRemoteRef.current = false), 50);
          } else {
            initialCodeRef.current = msg.code ?? "";
            setTimeout(() => (skipRemoteRef.current = false), 50);
          }
          return;
        }

        // REMOTE UPDATE
        if (msg.type === "code_update") {
          if (skipRemoteRef.current) return;

          const editor = editorRef.current;
          const model = editor?.getModel();
          if (!editor || !model) return;

          const curPos = editor.getPosition();
          const curOffset = curPos ? model.getOffsetAt(curPos) : null;

          skipRemoteRef.current = true;

          model.pushEditOperations(
            [],
            [
              {
                range: model.getFullModelRange(),
                text: msg.code || "",
              },
            ],
            () => null
          );

          setTimeout(() => {
            try {
              const newModel = editor.getModel();
              if (newModel && curOffset !== null) {
                const newOffset = Math.min(
                  curOffset,
                  newModel.getValueLength()
                );
                const newPos = newModel.getPositionAt(newOffset);
                editor.setPosition(newPos);
                editor.focus();
              }
            } catch {}

            skipRemoteRef.current = false;
          }, 10);
        }
      } catch (err) {
        console.error("WS parse error", err);
      }
    };
  }

  // ===== Send debounced updates =====
  const sendTimer = useRef<number | null>(null);

  function sendUpdate(code: string) {
    if (sendTimer.current) clearTimeout(sendTimer.current);

    sendTimer.current = window.setTimeout(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      skipRemoteRef.current = true;
      ws.send(JSON.stringify({ type: "code_update", code }));
      setTimeout(() => (skipRemoteRef.current = false), 50);
    }, 220);
  }

  // ===== Monaco mount =====
  function handleMount(
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoAPI: typeof monaco
  ) {
    editorRef.current = editor;

    // Apply buffered initial content
    if (initialCodeRef.current !== null) {
      skipRemoteRef.current = true;
      editor.setValue(initialCodeRef.current);
      editor.setPosition({ lineNumber: 1, column: 1 });
      initialCodeRef.current = null;
      setTimeout(() => (skipRemoteRef.current = false), 50);
    }

    // Remove old provider
    providerRef.current?.dispose();

    // Register autocomplete
    providerRef.current = monacoAPI.languages.registerCompletionItemProvider(
      "python",
      {
        triggerCharacters: [".", "_", "("],

        async provideCompletionItems(model, position) {
          const offset = model.getOffsetAt(position);
          const code = model.getValue();

          try {
            const res = await fetch(`${API_URL}/autocomplete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code,
                cursorPosition: offset,
                language: "python",
              }),
            });

            if (!res.ok) return { suggestions: [] };
            const data = await res.json();
            const suggestionText = data.suggestion || "";
            if (!suggestionText) return { suggestions: [] };

            const line = model.getLineContent(position.lineNumber);
            const before = line.substring(0, position.column - 1);
            const match = before.match(/([A-Za-z0-9_]+)$/);
            const start = match
              ? position.column - match[0].length
              : position.column;

            const range = new monacoAPI.Range(
              position.lineNumber,
              start,
              position.lineNumber,
              position.column
            );

            const isMulti = suggestionText.includes("\n");

            return {
              suggestions: [
                {
                  label: suggestionText,
                  kind: monacoAPI.languages.CompletionItemKind.Snippet,
                  insertText: suggestionText,
                  range,
                  documentation: "Server suggestion",
                  ...(isMulti && {
                    insertTextRules:
                      monacoAPI.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  }),
                },
              ],
            };
          } catch {
            return { suggestions: [] };
          }
        },
      }
    );

    editor.onDidChangeModelContent(() => {
      if (skipRemoteRef.current) return;
      sendUpdate(editor.getValue());
    });
  }

  // ===== Copy helpers =====
  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      setToast("Room id copied!");
    } catch {
      setToast("Copy failed");
    }
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast("Share link copied!");
    } catch {
      setToast("Copy failed");
    }
  }

  function handleLeaveClick() {
    if (!confirm("Are you sure you want to leave this room?")) return;
    wsRef.current?.close();
    onLeave();
  }

  // ===== Render =====
  return (
    <div className="editor-container">
      {/* Top bar */}
      <div className="editor-topbar">
        {/* LEFT */}
        <div className="room-info">
          <strong className="label">Room Id:</strong>

          <div className="input-with-icon">
            <input
              readOnly
              value={roomId}
              className="room-id-input"
              style={{ width: idWidth }}
              title="Room id"
            />
            <svg
              onClick={copyRoomId}
              className="copy-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v16h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 18H8V7h11v16z" />
            </svg>
          </div>

          <div className="small">Status: {status}</div>
        </div>

        {/* RIGHT */}
        <div className="controls">
          <strong className="label">Share link:</strong>

          <div className="input-with-icon">
            <input
              readOnly
              value={shareUrl}
              className="share-url-input"
              title="Share link"
            />
            <svg
              onClick={copyShare}
              className="copy-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v16h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 18H8V7h11v16z" />
            </svg>
          </div>

          <button className="btn danger" onClick={handleLeaveClick}>
            Leave
          </button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ height: "calc(100vh - 220px)" }}>
        <MonacoEditor
          height="100%"
          defaultLanguage="python"
          defaultValue="# Start coding..."
          onMount={handleMount}
          options={{
            fontFamily: "Menlo, Monaco, 'Roboto Mono', monospace",
            fontSize: 14,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollbar: { horizontal: "auto", vertical: "auto" },
          }}
        />
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
