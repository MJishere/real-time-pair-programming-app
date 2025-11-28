import type { Store } from "redux";
import { store } from "../store/store";
import { setStatus, setRoomId, setInitialCode, setRemoteCodeUpdate } from "../store/slices/roomSlice";
import { API_URL } from "../config";

type Message = { type: string; [k: string]: any };

class WsManager {
  private static _instance: WsManager | null = null;

  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private isManualClose = false;
  private connectAttempt = 0;
  private sendQueue: Message[] = [];
  private heartbeatTimer: number | null = null;
  private currentSocketId = 0;
  private store: Store;

  // --- NEW: buffer + listeners for initial_state so late subscribers still get it
  private initialBuffer: { code: string } | null = null;
  private initialListeners: Array<(payload: { code: string }) => void> = [];

  private constructor(storeRef: Store) {
    this.store = storeRef;
  }

  static getInstance(): WsManager {
    if (!WsManager._instance) {
      WsManager._instance = new WsManager(store);
    }
    return WsManager._instance;
  }

  connect(roomId: string) {
    if (!roomId) return;
    if (this.roomId === roomId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // already connected
    }

    this.disconnectInternal(false);

    this.roomId = roomId;
    this.isManualClose = false;
    this.connectAttempt = 0;
    this.createWebSocket();
    this.store.dispatch(setRoomId(roomId));
    this.store.dispatch(setStatus("connecting"));
  }

  disconnect() {
    this.isManualClose = true;
    this.disconnectInternal(true);
    this.roomId = null;
    this.store.dispatch(setRoomId(null));
    this.store.dispatch(setStatus("closed"));
  }

  // Public API: allow components to subscribe to initial_state notifications.
  // If an initial state is already buffered, the callback will be invoked immediately.
  onInitialState(cb: (payload: { code: string }) => void): () => void {
    // if we already have a buffered initial state, call immediately (microtask)
    if (this.initialBuffer) {
      // call async to avoid surprising sync re-entrancy
      setTimeout(() => cb(this.initialBuffer as { code: string }), 0);
    }
    this.initialListeners.push(cb);
    // return unsubscribe
    return () => {
      this.initialListeners = this.initialListeners.filter((c) => c !== cb);
    };
  }

  private disconnectInternal(clearSocketId: boolean) {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, "client disconnect");
        }
      } catch {}
      this.ws = null;
    }

    if (clearSocketId) {
      this.currentSocketId++;
    }
  }

  private createWebSocket() {
    if (!this.roomId) return;
    const socketId = ++this.currentSocketId;

    const wsProto = API_URL.startsWith("https") ? "wss" : "ws";
    const base = API_URL.replace(/^https?/, wsProto);
    const url = `${base}/ws/${this.roomId}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }

    this.ws = ws;
    this.store.dispatch(setStatus("connecting"));

    ws.onopen = () => {
      if (socketId !== this.currentSocketId) return;
      this.connectAttempt = 0;
      this.store.dispatch(setStatus("connected"));
      this.flushQueue();
      this.startHeartbeat();
    };

    ws.onmessage = (ev) => {
      if (socketId !== this.currentSocketId) return;
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "initial_state") {
          // dispatch to Redux
          this.store.dispatch(setInitialCode(msg.code ?? ""));

          // --- buffer & notify listeners (so late subscribers such as Editor onMount get it)
          this.initialBuffer = { code: msg.code ?? "" };
          // notify all listeners (call async)
          this.initialListeners.forEach((cb) => {
            try {
              setTimeout(() => cb({ code: msg.code ?? "" }), 0);
            } catch {}
          });
        } else if (msg.type === "code_update") {
          this.store.dispatch(setRemoteCodeUpdate(msg.code ?? ""));
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("ws parse error:", err);
      }
    };

    ws.onerror = () => {
      // eslint-disable-next-line no-console
      console.error("WebSocket error");
    };

    ws.onclose = () => {
      if (socketId !== this.currentSocketId) return;

      if (this.heartbeatTimer) {
        window.clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      if (this.isManualClose) {
        this.store.dispatch(setStatus("closed"));
        return;
      }

      this.store.dispatch(setStatus("closed"));
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    this.connectAttempt++;
    const maxBackoff = 30_000;
    const backoff = Math.min(1000 * Math.pow(1.6, this.connectAttempt - 1), maxBackoff) + Math.floor(Math.random() * 400);
    setTimeout(() => {
      if (!this.roomId || this.isManualClose) return;
      this.createWebSocket();
    }, backoff);
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try {
        this.ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
      } catch {}
    }, 20_000);
  }

  private flushQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.sendQueue.length > 0) {
      const m = this.sendQueue.shift()!;
      try {
        this.ws.send(JSON.stringify(m));
      } catch (e) {
        this.sendQueue.unshift(m);
        break;
      }
    }
  }

  sendCodeUpdate(code: string) {
    const payload = { type: "code_update", code };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch {
        this.sendQueue.push(payload);
      }
    } else {
      this.sendQueue.push(payload);
    }
  }
}

export const wsManager = WsManager.getInstance();
export default wsManager;
