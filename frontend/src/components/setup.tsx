"use client";

import React, { useEffect, useState } from "react";
import getSocket from "../../apis/connection";
import { useRouter } from "next/router";

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

const GameSetup: React.FC = () => {
  const router = useRouter();
  const socket = getSocket();
  const [username, setUsername] = useState("");
  const [shipsCount, setShipsCount] = useState<number | undefined>();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [txProgress, setTxProgress] = useState<{ shipId: number; txHash?: string }[]>([]);
  const [pellets, setPellets] = useState<Pellet[] | null>(null);
  const [startReadyData, setStartReadyData] = useState<null | { username: string; ships: Ship[]; txHash?: string; shipTxs?: { shipId: number; txHash: string }[] }>(null);
  const [hydraUrl, setHydraUrl] = useState<string>("");

  useEffect(() => {
    // listen for immediate pellets (backend emits them right away)
    const handlePellets = (data: { pelletsCoordinates: Pellet[] }) => {
      console.log("Received pellets-coordinates:", data);
      setPellets(data.pelletsCoordinates);
    };

    // receive per-ship txs while backend is creating ships
    const handleCreateShipTx = (data: { shipId: number; txHash: string }) => {
      console.log("Received create-ship-tx:", data);
      setTxProgress((prev) => {
        const next = [...prev];
        const idx = next.findIndex((p) => p.shipId === data.shipId);
        if (idx === -1) next.push({ shipId: data.shipId, txHash: data.txHash });
        else next[idx] = { shipId: data.shipId, txHash: data.txHash };
        return next;
      });
    };

    // final signal: backend has created ships and includes shipTxs + last txHash
    const handleStartReady = (data: { username: string; ships: Ship[]; txHash?: string; shipTxs?: { shipId: number; txHash: string }[] }) => {
      console.log("Received start-ready:", data);
      setStartReadyData(data);
      setIsLoading(false);
    };

    socket.on("pellets-coordinates", handlePellets);
    socket.on("create-ship-tx", handleCreateShipTx);
    socket.on("start-ready", handleStartReady);
    socket.on("error", (err: { message: string }) => {
      console.error("Server error:", err);
      setError(err.message);
      setIsLoading(false);
    });

    return () => {
      socket.off("pellets-coordinates", handlePellets);
      socket.off("create-ship-tx", handleCreateShipTx);
      socket.off("start-ready", handleStartReady);
      socket.off("error");
    };
  }, [socket]);

  // When the backend signals start-ready AND we already have pellets, proceed to /start
  useEffect(() => {
    if (startReadyData && pellets) {
      // persist the exact game state the frontend expects
      localStorage.setItem(
        "initialGameState",
        JSON.stringify({
          ships: startReadyData.ships,
          pellets,
          username: startReadyData.username,
          hydraUrl,
          txHash: startReadyData.txHash ?? null,
          shipTxs: startReadyData.shipTxs ?? [],
        })
      );
      // reset loading/progress and navigate
      setIsLoading(false);
      setTxProgress([]);
      router.push("/start");
    }
  }, [startReadyData, pellets, router, hydraUrl]);

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!hydraUrl.trim()) {
      setError("Enter your Hydra API URL");
      setIsLoading(false);
      return;
    }

    if (!username.trim()) {
      setError("Enter a username");
      setIsLoading(false);
      return;
    }

    if (!shipsCount || shipsCount < 1 || shipsCount > 5) {
      setError("Enter a number of ships between 1 and 5");
      setIsLoading(false);
      return;
    }

    const shipProps: Ship[] = Array.from({ length: shipsCount }, (_, index) => {
      const x = Math.random() < 0.5 ? Math.floor(Math.random() * 41) + 10 : Math.floor(Math.random() * 41) - 50;
      const y = Math.random() < 0.5 ? Math.floor(Math.random() * 41) + 10 : Math.floor(Math.random() * 41) - 50;
      return { id: index, x, y };
    });

    // Reset progress trackers
    setTxProgress(shipProps.map((s) => ({ shipId: s.id })));
    setStartReadyData(null);

    // Emit the hydra URL and initial ship coordinates
    socket.emit("hydra-url", { hydraUrl });
    socket.emit("initial-shipCoordinates", { shipProperty: { username, ships: shipProps } });

    // Keep loading until we receive start-ready
    setIsLoading(true);
  };

  // small helper to render progress
  const renderProgress = () => {
    if (!isLoading) return null;
    return (
      <div className="text-sm text-black">
        <strong>Creating ships:</strong>
        <ul>
          {txProgress.map((p) => (
            <li key={p.shipId}>
              Ship #{p.shipId}: {p.txHash ? <span className="text-green-600">tx {p.txHash.slice(0, 8)}...</span> : <span>pending...</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // placeholder input styles kept from your original
  const inputPlaceholderStyle = { fontFamily: "'monocraft', 'monospace', 'DM Sans', 'sans-serif'", letterSpacing: "0.03em" };

  return (
    <div className="fixed bottom-5 left-0 w-full flex items-center justify-center bg-transparent z-30 ">
      <div className="relative z-20 flex items-center rounded-lg justify-between w-full max-w-5xl px-6 py-4 bg-[#e9ebee] border-t-4  backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-grey-700 rounded-full flex items-center justify-center text-black font-monocraft-regular text-base border-2 border-black">0</div>
          <div className="text-sm font-monocraft-regular text-[#000000] px-2 py-1 bg-[#9999a7] rounded border border-[#000000] shadow">{username || "Player"}</div>
        </div>

        <form onSubmit={handleCreateGame} className="flex items-center gap-4">
          <input type="url" placeholder="Hydra API URL" value={hydraUrl} onChange={(e) => setHydraUrl(e.target.value)} className="font-monocraft-regular placeholder:font-monocraft-regular placeholder:text-[#000000] bg-[#e9ebee] border-2 border-[#0a0b0c] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all w-64" style={inputPlaceholderStyle} disabled={isLoading} autoComplete="off" spellCheck={false} name="hydraUrl" />
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="font-monocraft-regular placeholder:font-monocraft-regular placeholder:text-[#000000] bg-[#e9ebee] border-2 border-[#0a0b0c] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all" style={inputPlaceholderStyle} disabled={isLoading} autoComplete="off" spellCheck={false} name="username" />
          <input type="number" placeholder="Ships (1-5)" value={shipsCount === undefined ? "" : shipsCount} onChange={(e) => setShipsCount(e.target.value ? parseInt(e.target.value) : undefined)} min={1} max={5} className="font-monocraft-regular placeholder:font-monocraft-regular placeholder:text-[#000000] bg-[#e9ebee] border-2 border-[#0a0b0c] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all w-60" style={{ ...inputPlaceholderStyle, fontFamily: "'monocraft', 'monospace'" }} disabled={isLoading} autoComplete="off" spellCheck={false} name="shipsCount" />
          <button type="submit" className="font-monocraft-regular text-sm bg-[#23233a] text-white border-2 border-grey-400 rounded-lg px-4 py-2 shadow-lg hover:from-blue-200 hover:to-grey-400 hover:scale-105 transition-all disabled:opacity-50" disabled={isLoading}>Start</button>
        </form>

        <div className="flex items-center gap-3">
          {error && <p className="text-red-300 font-monocraft-regular text-sm bg-[#2a1a1a80] rounded py-1 px-2 border border-black-400">{error}</p>}
          {isLoading && <p className="text-blue-200 font-monocraft-regular text-sm bg-[#1a2a3a80] rounded py-1 px-2 border border-blue-400 animate-pulse">Creating...</p>}
        </div>
      </div>

      {/* progress display */}
      <div className="fixed bottom-24 left-6 z-40 p-3 bg-white rounded shadow">
        {renderProgress()}
      </div>
    </div>
  );
};

export default GameSetup;
