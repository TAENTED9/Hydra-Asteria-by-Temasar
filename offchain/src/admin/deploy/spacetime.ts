import "dotenv/config";
import { admin_token, fuel_per_step, max_ship_fuel, max_speed } from "../../../const.js";
import { Asset, conStr0, MeshTxBuilder, scriptHash } from "@meshsdk/core";
import { blockchainProvider, myWallet, writeScriptRefJson, readScripRefJson } from "../../../utils.js";
import { applyParamtoDeploy } from "../apply-param/deploy.js";
import { applyParamtoSpacetime } from "../apply-param/spacetime.js";
import { resolvePlutusScriptAddress } from "@meshsdk/core-csl";

// Helper: wait for script UTXO at address
async function waitForScriptUtxo(txHash: string, scriptAddress: string, retries = 60, delayMs = 5000) {
  if (!scriptAddress) throw new Error("scriptAddress is required");
  for (let attempt = 1; attempt <= retries; attempt++) {
    const utxos = await blockchainProvider.fetchAddressUTxOs(scriptAddress);
    const found = utxos.find(u => u.tx_hash === txHash);
    if (found) return found;
    console.log(`⏳ Waiting for script UTXO at ${scriptAddress}, attempt ${attempt}/${retries}`);
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error(`❌ Script UTXO not found at ${scriptAddress} for tx ${txHash}`);
}

export async function deploySpacetime(selectedUtxo?: any) {
  try {
    const utxos = await myWallet.getUtxos();
    const changeAddress = await myWallet.getChangeAddress();

    const pelletRef = await readScripRefJson("pelletref");
    const asteriaRef = await readScripRefJson("asteriaref");

    if (!pelletRef?.address) throw new Error("pelletref missing address");
    if (!asteriaRef?.address) throw new Error("asteriaref missing address");

    const pelletUtxo = await waitForScriptUtxo(pelletRef.txHash, pelletRef.address);
    const asteriaUtxo = await waitForScriptUtxo(asteriaRef.txHash, asteriaRef.address);

    const pelletScriptHash = pelletUtxo.output.scriptHash;
    const asteriaScriptHash = asteriaUtxo.output.scriptHash;

    const spacetimeScript = applyParamtoSpacetime(
      scriptHash(pelletScriptHash!),
      scriptHash(asteriaScriptHash!),
      admin_token,
      max_speed,
      max_ship_fuel,
      fuel_per_step
    );

    const deployScript = applyParamtoDeploy(admin_token);
    const deployScriptAddressBech32 = resolvePlutusScriptAddress(deployScript.plutusScript, 0);

    const spacetimeAsset: Asset[] = [{ unit: "lovelace", quantity: "35088510" }];

    const txBuilder = new MeshTxBuilder({
      fetcher: blockchainProvider,
      submitter: blockchainProvider,
      verbose: true,
    });

    const utxoToUse = selectedUtxo ?? utxos[0];

    const unsignedTx = await txBuilder
      .txOut(deployScriptAddressBech32, spacetimeAsset)
      .txOutInlineDatumValue(conStr0([]), "JSON")
      .txOutReferenceScript(spacetimeScript.cborScript, "V3")
      .selectUtxosFrom([utxoToUse])
      .changeAddress(changeAddress)
      .setNetwork("preprod")
      .complete();

    const signedTx = await myWallet.signTx(unsignedTx);
    const txHash = await myWallet.submitTx(signedTx);

    await waitForScriptUtxo(txHash, deployScriptAddressBech32);
    await writeScriptRefJson("spacetimeref", txHash, deployScriptAddressBech32);

    console.log("✅ Spacetime deployed successfully with tx:", txHash);
    return txHash;
  } catch (err) {
    console.error("❌ deploySpacetime failed:", err);
    throw err;
  }
}
