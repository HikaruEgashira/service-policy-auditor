import type { StorageData } from "@ai-service-exposure/core";
import { DEBUG_PORT, type DebugCommand, type DebugMessage } from "./protocol.js";

export interface DebugClient {
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
}

export interface DebugClientOptions {
  port?: number;
  getStorage: () => Promise<StorageData>;
  clearStorage: () => Promise<void>;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function createDebugClient(options: DebugClientOptions): DebugClient {
  const port = options.port ?? DEBUG_PORT;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) return;

    try {
      ws = new WebSocket(`ws://localhost:${port}`);

      ws.onopen = () => {
        console.log("[Debug] Connected to debug server");
        options.onConnect?.();
      };

      ws.onmessage = async (event) => {
        try {
          const command = JSON.parse(event.data) as DebugCommand;
          await handleCommand(command);
        } catch (error) {
          console.error("[Debug] Failed to handle command:", error);
        }
      };

      ws.onclose = () => {
        console.log("[Debug] Disconnected from debug server");
        options.onDisconnect?.();
        scheduleReconnect();
      };

      ws.onerror = () => {
        // Will trigger onclose
      };
    } catch {
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 3000);
  }

  async function handleCommand(command: DebugCommand) {
    let response: DebugMessage;

    switch (command.type) {
      case "get_storage":
        const data = await options.getStorage();
        response = { type: "storage_data", data };
        break;

      case "clear_storage":
        await options.clearStorage();
        response = { type: "storage_cleared" };
        break;

      case "ping":
        response = { type: "pong" };
        break;

      default:
        response = { type: "error", message: "Unknown command" };
    }

    send(response);
  }

  function send(message: DebugMessage) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    ws?.close();
    ws = null;
  }

  function isConnected(): boolean {
    return ws?.readyState === WebSocket.OPEN;
  }

  return { connect, disconnect, isConnected };
}
