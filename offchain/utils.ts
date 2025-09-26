import * as dotenv from "dotenv";
import util from "util";
import { BlockfrostProvider, MeshWallet, mConStr0 } from "@meshsdk/core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// BLOCKFROST PROJECT ID
const projectIdRaw = process.env.BLOCKFROST_APIKEY;

console.log("🔑 BLOCKFROST_APIKEY typeof:", typeof projectIdRaw);
console.log("🔑 BLOCKFROST_APIKEY raw value:", util.inspect(projectIdRaw, { depth: 5 }));

if (!projectIdRaw || typeof projectIdRaw !== "string") {
  throw new Error("BLOCKFROST_APIKEY must be defined in .env as a plain string.");
}

const projectId = projectIdRaw.trim();
if (!projectId) {
  throw new Error("BLOCKFROST_APIKEY is empty after trimming.");
}

// PROVIDER
export const blockchainProvider = new BlockfrostProvider(projectId);
export const maestroprovider = blockchainProvider;

const isMainnet = process.env.BLOCKFROST_NETWORK?.toLowerCase() === "mainnet";

function buildMeshWalletFromSeed(): MeshWallet {
  const seed = process.env.SEED_PHRASE;
  if (!seed) throw new Error("SEED_PHRASE env var required");

  const networkId = isMainnet ? 1 : 0;
  const isMnemonic = /\s+/.test(seed.trim());

  if (isMnemonic) {
    const words = seed.trim().split(/\s+/);
    return new MeshWallet({
      networkId,
      fetcher: blockchainProvider,
      submitter: blockchainProvider,
      key: { type: "mnemonic", words },
    });
  } else {
    return new MeshWallet({
      networkId,
      fetcher: blockchainProvider,
      submitter: blockchainProvider,
      key: { type: "root", bech32: seed.trim() },
    });
  }
}

export const myWallet = buildMeshWalletFromSeed();

// SCRIPT REF JSON HELPERS
const refDir = path.join(__dirname, "../../backend/src/admin/deploy/ref-script");

/**
 * Write a script reference JSON with txHash and optional address
 */
export async function writeScriptRefJson(fileName: string, txHash: string, address?: string) {
  if (!fs.existsSync(refDir)) fs.mkdirSync(refDir, { recursive: true });

  const data: any = { txHash };
  if (address) data.address = address;

  const filePath = path.join(refDir, `${fileName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export async function readScripRefJson(fileName: string) {
  const filePath = path.join(refDir, `${fileName}.json`);
  if (!fs.existsSync(filePath)) return null;
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
}

// UTILITY
export function conStr0(arr: any[]): any {
  return mConStr0(arr);
}

// TX SLOT HELPERS (dummy)
export function tx_earliest_slot(): number { return 0; }
export function tx_latest_slot(): number { return 99999999; }
