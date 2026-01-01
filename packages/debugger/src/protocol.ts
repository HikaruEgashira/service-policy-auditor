import type { StorageData } from "@ai-service-exposure/core";

export const DEBUG_PORT = 9229;

export type DebugCommand =
  | { type: "get_storage" }
  | { type: "clear_storage" }
  | { type: "ping" };

export type DebugMessage =
  | { type: "storage_data"; data: StorageData }
  | { type: "storage_cleared" }
  | { type: "pong" }
  | { type: "error"; message: string }
  | { type: "connected"; extensionId: string };
