import { WebSocketServer, WebSocket } from "ws";
import type { StorageData } from "@ai-service-exposure/core";
import { DEBUG_PORT, type DebugCommand, type DebugMessage } from "./protocol.js";

export interface DebugServerOptions {
  port?: number;
  onStorageUpdate?: (data: StorageData) => void;
}

export class DebugServer {
  private wss: WebSocketServer;
  private extensionSocket: WebSocket | null = null;
  private pendingRequests: Map<string, (data: DebugMessage) => void> = new Map();
  private options: DebugServerOptions;

  constructor(options: DebugServerOptions = {}) {
    this.options = options;
    const port = options.port ?? DEBUG_PORT;

    this.wss = new WebSocketServer({ port });
    console.log(`Debug server listening on ws://localhost:${port}`);

    this.wss.on("connection", (ws) => {
      console.log("Extension connected");
      this.extensionSocket = ws;

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as DebugMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error("Failed to parse message:", error);
        }
      });

      ws.on("close", () => {
        console.log("Extension disconnected");
        this.extensionSocket = null;
      });
    });
  }

  private handleMessage(message: DebugMessage) {
    if (message.type === "storage_data" && this.options.onStorageUpdate) {
      this.options.onStorageUpdate(message.data);
    }

    for (const [, resolve] of this.pendingRequests) {
      resolve(message);
    }
    this.pendingRequests.clear();
  }

  async getStorage(): Promise<StorageData | null> {
    if (!this.extensionSocket) {
      console.log("No extension connected");
      return null;
    }

    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      this.pendingRequests.set(id, (msg) => {
        if (msg.type === "storage_data") {
          resolve(msg.data);
        } else {
          resolve(null);
        }
      });

      this.send({ type: "get_storage" });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve(null);
        }
      }, 5000);
    });
  }

  async clearStorage(): Promise<boolean> {
    if (!this.extensionSocket) {
      return false;
    }

    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      this.pendingRequests.set(id, (msg) => {
        resolve(msg.type === "storage_cleared");
      });

      this.send({ type: "clear_storage" });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve(false);
        }
      }, 5000);
    });
  }

  private send(command: DebugCommand) {
    if (this.extensionSocket?.readyState === WebSocket.OPEN) {
      this.extensionSocket.send(JSON.stringify(command));
    }
  }

  isConnected(): boolean {
    return this.extensionSocket !== null;
  }

  close() {
    this.wss.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new DebugServer({
    onStorageUpdate: (data) => {
      console.log("\nStorage updated:");
      console.log(`  Services: ${Object.keys(data.services).length}`);
      console.log(`  Events: ${data.events.length}`);
    },
  });

  console.log("Waiting for extension to connect...");
  console.log("Press Ctrl+C to stop\n");

  process.on("SIGINT", () => {
    server.close();
    process.exit(0);
  });
}
