//backend/index.ts
import path from "path";
import "dotenv/config";
import { fileURLToPath } from "url";
import { Server, Socket } from "socket.io";
import { createServer } from "http";
import express from "express";
import { createShip } from "../offchain/src/user/create-ship.js";
import { gatherFuel } from "../offchain/src/user/gather-fuel.js";
import { mineAsteria } from "../offchain/src/user/mine-asteria.js";
import { moveShip } from "../offchain/src/user/move-ship.js";
import { quit } from "../offchain/src/user/quit.js";
import { writeFile, readFile, mkdir } from "fs/promises";
import { readPelletsCsvFile } from "../offchain/src/admin/pellet/utils.js";
import { HydraProvider } from "@meshsdk/hydra";

interface Ship {
  id: number;
  x: number;
  y: number;
}

interface Pellet {
  id: number;
  x: number;
  y: number;
  fuel: number;
}

interface GameState {
  ships: { [username: string]: Ship[] };
  pellets: Pellet[];
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const hydraProvider = new HydraProvider({
  url: process.env.HYDRA_URL ?? "http://localhost:4001",
});

const gameState: GameState = {
  ships: {},
  pellets: [],
};

// ESM-safe __dirname and path to ships.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const shipsJsonPath = path.join(__dirname, "user-hash", "ships.json");

// In-memory map of latest txHash per username
const shipTxHashes: { [username: string]: string } = {};

async function ensureUserHashDir() {
  await mkdir(path.dirname(shipsJsonPath), { recursive: true });
}

async function readShipTxHashFromFile(): Promise<string | undefined> {
  try {
    const fileContent = await readFile(shipsJsonPath, "utf-8");
    return JSON.parse(fileContent).txHash;
  } catch {
    return undefined;
  }
}

// load pellets safely at startup
let pelletFromCsv: { posX: number; posY: number; fuel: string }[] = [];
try {
  pelletFromCsv = await readPelletsCsvFile();
  console.log("Pellets from CSV:", pelletFromCsv);
  gameState.pellets = pelletFromCsv.map((pellet, index) => ({
    id: index,
    x: pellet.posX,
    y: pellet.posY,
    fuel: Number.parseInt(pellet.fuel ?? "0", 10),
  }));
} catch (err) {
  console.error("Failed to load pellets CSV at startup:", err);
  gameState.pellets = [];
}

io.on("connection", async (socket: Socket) => {
  console.log("New client connected:", socket.id);

  // Emit pellets immediately to this client
  socket.emit("pellets-coordinates", { pelletsCoordinates: gameState.pellets });

  socket.on(
    "initial-shipCoordinates",
    async (data: { shipProperty: { username: string; ships: Ship[] } }) => {
      const { username, ships } = data.shipProperty;

      socket.emit("pellets-coordinates", { pelletsCoordinates: gameState.pellets });

      if (!Array.isArray(ships)) {
        socket.emit("error", { message: "Ship data is not an array" });
        return;
      }

      try {
        (socket as any).data = (socket as any).data || {};
        (socket as any).data.username = username;

        // collect per-ship tx info so frontend can see progress and final txs
        const shipTxs: { shipId: number; txHash: string }[] = [];
        let lastTxHash: string | undefined;

        // Emit pellets immediately so frontend can render them while txs are being built
        socket.emit("pellets-coordinates", { pelletsCoordinates: gameState.pellets });

        for (const ship of ships) {
          const txHash = await createShip(ship.x, ship.y);
          if (!txHash) throw new Error(`Failed to create ship at (${ship.x}, ${ship.y})`);
          lastTxHash = txHash;

          // persist latest txHash to disk
          await ensureUserHashDir();
          await writeFile(shipsJsonPath, JSON.stringify({ txHash }));

          // record this ship's tx for final payload
          shipTxs.push({ shipId: ship.id, txHash });

          // notify the requesting socket about this ship tx (so frontend can show progress)
          socket.emit("create-ship-tx", { shipId: ship.id, txHash });

          console.log(`Created ship ${ship.id} tx: ${txHash}`);
        }

        // Save final mapping and game state
        if (lastTxHash) {
          shipTxHashes[username] = lastTxHash;
          (socket as any).data.txHash = lastTxHash;
        }
        gameState.ships[username] = ships;

        // Broadcast created ship positions to all clients
        io.emit("createship-coordinates", { coordinatesArray: ships });

        // Final notification (only after backend has real txs)
        socket.emit("start-ready", {
          username,
          ships,
          txHash: lastTxHash,
          shipTxs, // per-ship tx info
        });

        console.log(`Start-ready emitted for ${username} with txHash ${lastTxHash}`);
      } catch (err) {
        console.error("Error processing initial-shipCoordinates:", err);
        socket.emit("error", { message: "Failed to initialize ships or pellets" });
      }
    }
  );

  socket.on(
    "ship-moved",
    async (data: { id: number; dx: number; dy: number }) => {
      const { id, dx, dy } = data;

      try {
        let username: string | undefined;
        let ship: Ship | undefined;
        let shipIndex: number = -1;

        for (const user in gameState.ships) {
          const userShips = gameState.ships[user];
          shipIndex = userShips.findIndex((s) => s.id === id);
          if (shipIndex !== -1) {
            username = user;
            ship = { ...userShips[shipIndex] };
            break;
          }
        }

        if (!username || !ship) {
          socket.emit("error", { message: `Ship not found for ID ${id}` });
          return;
        }

        let shipTxHash = shipTxHashes[username] ?? (await readShipTxHashFromFile());
        if (!shipTxHash) {
          socket.emit("error", { message: "No ship transaction hash available" });
          return;
        }

        const newX = Math.max(-50, Math.min(50, ship.x + dx));
        const newY = Math.max(-50, Math.min(50, ship.y + dy));
        if (newX === ship.x && newY === ship.y) return;

        ship.x = newX;
        ship.y = newY;
        gameState.ships[username][shipIndex] = ship;

        io.emit("ship-moved", { ship });

        const moveTxHash = await moveShip(dx, dy, shipTxHash);
        if (!moveTxHash) {
          socket.emit("error", { message: `Failed to move ship ${id}` });
          return;
        }

        shipTxHashes[username] = moveTxHash;
        await ensureUserHashDir();
        await writeFile(shipsJsonPath, JSON.stringify({ txHash: moveTxHash }));

        const pelletIndex = gameState.pellets.findIndex(
          (p) => p.x === ship.x && p.y === ship.y
        );
        if (pelletIndex !== -1) {
          const collectedPellet = gameState.pellets.splice(pelletIndex, 1)[0];

          const fuelTxHash = await gatherFuel(
            collectedPellet.fuel.toString(),
            moveTxHash,
            20
          );
          if (fuelTxHash) {
            io.emit("pellet-collected", { pelletId: collectedPellet.id });
            shipTxHashes[username] = fuelTxHash;
            await ensureUserHashDir();
            await writeFile(shipsJsonPath, JSON.stringify({ txHash: fuelTxHash }));
          } else {
            socket.emit("error", { message: "Failed to gather fuel" });
          }
        }

        if (ship.x === 0 && ship.y === 0) {
          const mineBaseTx = shipTxHashes[username] ?? (await readShipTxHashFromFile());
          if (mineBaseTx) {
            const mineTxHash = await mineAsteria(mineBaseTx);
            if (mineTxHash) {
              shipTxHashes[username] = mineTxHash;
              await ensureUserHashDir();
              await writeFile(shipsJsonPath, JSON.stringify({ txHash: mineTxHash }));
              io.emit("asteria-mined", { username });
              gameState.ships = {};
              gameState.pellets = [];
              io.emit("game-cleared", { message: "Game reset due to Asteria mined" });
            } else {
              socket.emit("error", { message: "Failed to mine Asteria" });
            }
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          socket.emit("error", { message: `Failed to process ship movement: ${err.message}` });
        }
      }
    }
  );

  socket.on("quit", async (data: { username: string }) => {
    const username = data.username;
    try {
      let shipTxHash = shipTxHashes[username] ?? (await readShipTxHashFromFile());
      if (!shipTxHash) {
        socket.emit("error", { message: "No ship transaction hash available" });
        return;
      }

      const quitTxHash = await quit(shipTxHash);
      if (!quitTxHash) throw new Error(`Failed to process quit for ${username}`);

      await ensureUserHashDir();
      await writeFile(shipsJsonPath, JSON.stringify({ txHash: quitTxHash }));

      delete shipTxHashes[username];
      delete gameState.ships[username];

      io.emit("game-cleared", {
        username,
        message: `${username} has quit the game`,
      });
    } catch (err) {
      socket.emit("error", { message: `Failed to process quit for ${username}` });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = Number(process.env.PORT ?? 3002);
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
