import { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import "./Editor.css";

// API base Url
import { API_URL } from "../config";

// Web Socket manager
import { wsManager } from "../ws/wsManager";

// Redux state and dispatch helpers
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../store/store";
import { setRoomId, setStatus } from "../store/slices/roomSlice";

type Props = {
  roomId: string;
  onLeave: () => void;
};

export default function EditorMonaco({ roomId, onLeave }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const roomCode = useSelector((s: RootState) => s.room.code);
  const status = useSelector((s: RootState) => s.room.status);
  const lastRemoteUpdateAt = useSelector((s: RootState) => s.room.lastRemoteUpdateAt);

  const [toast, setToast] = useState<string | null>(null);
  
  // Flags to track editor + remote sync
  const skipRemoteRef = useRef(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const providerRef = useRef<monaco.IDisposable | null>(null);
  const appliedRemoteAtRef = useRef<number | null>(null);

  // Share link & dynamic input width
  const shareUrl = `${window.location.origin}/room/${roomId}`;
  const idWidth = `${Math.min(60, Math.max(20, roomId.length))}ch`;

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // On room change -> update Redux + connect WS
  useEffect(() => {
    dispatch(setRoomId(roomId));
    dispatch(setStatus("connecting"));

    wsManager.connect(roomId);

    return () => {
      // Cleanup provider + initial-state listener
      try {
        providerRef.current?.dispose();
        const unsub = (providerRef as any).__initialUnsub;
        if (typeof unsub === "function") unsub();
        (providerRef as any).__initialUnsub = undefined;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Sync remote code → editor if needed
  function applyRoomCodeToEditorIfNeeded() {
    try {
      const editor = editorRef.current;
      if (!editor) return;

      if (lastRemoteUpdateAt === null) return;
      if (appliedRemoteAtRef.current === lastRemoteUpdateAt) return;

      appliedRemoteAtRef.current = lastRemoteUpdateAt;

      skipRemoteRef.current = true;
      const model = editor.getModel();
      if (!model) {
        skipRemoteRef.current = false;
        return;
      }

      const curPos = editor.getPosition();
      const curOffset = curPos ? model.getOffsetAt(curPos) : null;

      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: roomCode }],
        () => null
      );

      // Restore cursor after update
      setTimeout(() => {
        try {
          const newModel = editor.getModel();
          if (newModel && curOffset !== null) {
            const newOffset = Math.min(curOffset, newModel.getValueLength());
            const newPos = newModel.getPositionAt(newOffset);
            editor.setPosition(newPos);
            editor.focus();
          }
        } catch {}
        skipRemoteRef.current = false;
      }, 8);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("applyRoomCodeToEditorIfNeeded error", e);
    }
  }

  // Apply remote updates whenever Redux changes
  useEffect(() => {
    applyRoomCodeToEditorIfNeeded();
  }, [roomCode, lastRemoteUpdateAt]);

  // Monaco mount and autocomplete registration
  function handleMount(editor: monaco.editor.IStandaloneCodeEditor, monacoAPI: typeof monaco) {
    editorRef.current = editor;
    providerRef.current?.dispose();

    // Register completion provider
    providerRef.current = monacoAPI.languages.registerCompletionItemProvider("python", {
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

          // Build replacement range for autocomplete
          const line = model.getLineContent(position.lineNumber);
          const before = line.substring(0, position.column - 1);
          const match = before.match(/([A-Za-z0-9_]+)$/);
          const start = match ? position.column - match[0].length : position.column;

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
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("autocomplete error:", e);
          return { suggestions: [] };
        }
      },
    });

    // debounce local edits and send via wsManager
    let timeout: number | null = null;
    editor.onDidChangeModelContent(() => {
      if (skipRemoteRef.current) return;
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        const code = editor.getValue();
        wsManager.sendCodeUpdate(code);
      }, 220);
    });

    // Apply any pending room code that arrived before editor mounted
    applyRoomCodeToEditorIfNeeded();

    // Listen for initial room state sent over WebSocket
    const unsubscribe = wsManager.onInitialState(({ code }) => {
      try {
        if (!editorRef.current) return;
        skipRemoteRef.current = true;
        const model = editorRef.current.getModel();
        if (model) {
          const curPos = editorRef.current.getPosition();
          const curOffset = curPos ? model.getOffsetAt(curPos) : null;
          model.pushEditOperations([], [{ range: model.getFullModelRange(), text: code }], () => null);
          setTimeout(() => {
            try {
              const newModel = editorRef.current!.getModel();
              if (newModel && curOffset !== null) {
                const newOffset = Math.min(curOffset, newModel.getValueLength());
                const newPos = newModel.getPositionAt(newOffset);
                editorRef.current!.setPosition(newPos);
                editorRef.current!.focus();
              }
            } catch {}
            skipRemoteRef.current = false;
          }, 8);
        }
      } catch (e) {
        // swallow
      }
    });

    // save unsubscribe so cleanup can remove it
    (providerRef as any).__initialUnsub = unsubscribe;
  }

  // Fallback clipboard helper
  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();

      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("copyToClipboard failed", err);
      return false;
    }
  }

  // Copy room id
  async function copyRoomId(e?: any) {
    // prevent other handlers from also running and showing stale toasts
    e?.preventDefault?.();
    e?.stopImmediatePropagation?.();

    const ok = await copyToClipboard(roomId);
    if (ok) setToast("Room id copied!");
    else setToast("Copy failed");
  }

  // Copy share URL
  async function copyShare(e?: any) {
    e?.preventDefault?.();
    e?.stopImmediatePropagation?.();

    const ok = await copyToClipboard(shareUrl);
    if (ok) setToast("Share link copied!");
    else setToast("Copy failed");
  }

  // leave: disconnect manager and run onLeave
  function handleLeaveClick() {
    if (!confirm("Are you sure you want to leave this room?")) return;
    wsManager.disconnect();
    onLeave();
  }

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
              onClick={(e) => copyRoomId(e)}
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
              onClick={(e) => copyShare(e)}
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
