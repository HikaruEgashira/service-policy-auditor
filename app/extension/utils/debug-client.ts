import type { StorageData } from "@ai-service-exposure/core";

const DEBUG_PORT = 9229;

interface DebugCommand {
  type: "get_storage" | "clear_storage" | "ping";
}

interface DebugMessage {
  type: string;
  data?: StorageData;
  message?: string;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connected = false;

type StorageGetter = () => Promise<StorageData>;
type StorageClearer = () => Promise<void>;

let getStorageFn: StorageGetter;
let clearStorageFn: StorageClearer;

export function initDebugClient(
  getStorage: StorageGetter,
  clearStorage: StorageClearer
) {
  getStorageFn = getStorage;
  clearStorageFn = clearStorage;
  connect();
}

function connect() {
  if (ws?.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(`ws://localhost:${DEBUG_PORT}`);

    ws.onopen = () => {
      connected = true;
      console.log("[Debug] Connected to debug server");
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
      if (connected) {
        console.log("[Debug] Disconnected from debug server");
      }
      connected = false;
      scheduleReconnect();
    };

    ws.onerror = () => {
      // Silent - will trigger onclose
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
  }, 10000);
}

async function handleCommand(command: DebugCommand) {
  let response: DebugMessage;

  switch (command.type) {
    case "get_storage":
      const data = await getStorageFn();
      response = { type: "storage_data", data };
      break;

    case "clear_storage":
      await clearStorageFn();
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
