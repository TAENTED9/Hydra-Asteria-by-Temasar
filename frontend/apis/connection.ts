import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

const getSocket = (): Socket => {
  if (!socket) {
    socket = io("http://localhost:3002", {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socket.on("connect", () => {
      console.log("Connected to WebSocket server");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });
  }
  return socket;
};

export default getSocket;