import { myWallet } from "../../../utils.js";

export async function waitForUtxo(txHash: string, retries = 60, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const utxos = await myWallet.getUtxos();
    const found = utxos.find((u: any) => {
      const input = u.input ?? u.txIn ?? u;
      const txh = input?.txHash ?? input?.tx_hash ?? input?.txId ?? input?.tx_id ?? u?.txHash ?? u?.tx_hash;
      return txh === txHash;
    });
    if (found) return found;
    await new Promise(res => setTimeout(res, delayMs));
  }
  throw new Error(`UTXO not found for tx ${txHash} after ${retries} retries`);
}
