import "dotenv/config";
import { admin_token } from "../../../const.js";
import { applyParamtoPellet } from "../apply-param/pellet.js";
import { applyParamtoDeploy } from "../apply-param/deploy.js";
import { maestroprovider, blockchainProvider, myWallet, writeScriptRefJson } from "../../../utils.js";
import { Asset, conStr0, MeshTxBuilder } from "@meshsdk/core";
import { resolvePlutusScriptAddress } from "@meshsdk/core-csl";
import { waitForUtxo } from "./waitForUtxo.js";

// Prepare scripts
const pellet = applyParamtoPellet(admin_token);
if (!pellet?.cborScript) throw new Error("applyParamtoPellet did not return a CBOR script");

const deployScript = applyParamtoDeploy(admin_token);
if (!deployScript?.plutusScript) throw new Error("applyParamtoDeploy did not return a Plutus script");

const deployAddressBech32 = resolvePlutusScriptAddress(deployScript.plutusScript, 0);

// Pellet asset to deploy
const pelletAsset: Asset[] = [{ unit: "lovelace", quantity: "20000000" }];

export async function deployPellet(selectedUtxo?: any) {
  try {
    console.log("🔧 deployPellet: fetching wallet UTXOs...");
    let utxos = await myWallet.getUtxos();
    if (!utxos || utxos.length === 0) throw new Error("No UTXO available in wallet to fund pellet deployment");

    const changeAddress = await myWallet.getChangeAddress();
    const utxoToUse = selectedUtxo ?? utxos[0];

    const txBuilder = new MeshTxBuilder({
      fetcher: maestroprovider ?? blockchainProvider,
      submitter: maestroprovider ?? blockchainProvider,
      verbose: true,
    });

    const unsignedTx = await txBuilder
      .txOut(deployAddressBech32, pelletAsset)
      .txOutInlineDatumValue(conStr0([]), "JSON")
      .txOutReferenceScript(pellet.cborScript, "V3")
      .selectUtxosFrom([utxoToUse])
      .changeAddress(changeAddress)
      .setNetwork("preprod")
      .complete();

    const signedTx = await myWallet.signTx(unsignedTx, true);
    const txHash = await myWallet.submitTx(signedTx);

    // Wait for UTXO confirmation
    await waitForUtxo(txHash);

    // Save txHash + deploy script address
    await writeScriptRefJson("pelletref", txHash, deployAddressBech32);
    console.log("✅ deployPellet: pelletref written with address");

    return txHash;
  } catch (err) {
    console.error("❌ deployPellet failed:", err);
    throw err;
  }
}
