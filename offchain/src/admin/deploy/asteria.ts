import "dotenv/config";
import { admin_token, ship_mint_lovelace_fee, max_asteria_mining, min_asteria_distance, initial_fuel } from "../../../const.js";
import { Asset, conStr0, MeshTxBuilder, scriptHash } from "@meshsdk/core";
import { maestroprovider, blockchainProvider, myWallet, writeScriptRefJson, readScripRefJson } from "../../../utils.js";
import { applyParamtoAsteria } from "../apply-param/Asteria.js";
import { applyParamtoDeploy } from "../apply-param/deploy.js";
import { resolvePlutusScriptAddress } from "@meshsdk/core-csl";
import { waitForUtxo } from "./waitForUtxo.js";

const providerForTx = maestroprovider ?? blockchainProvider;

export async function deployAsteria(selectedUtxo = undefined) {
  try {
    const changeAddress = await myWallet.getChangeAddress();

    const pelletRef = await readScripRefJson("pelletref");
    if (!pelletRef?.txHash) throw new Error("pelletref missing txHash");
    await waitForUtxo(pelletRef.txHash);

    const pelletTxUtxos = await providerForTx.fetchUTxOs(pelletRef.txHash);
    const pelletUtxo = pelletTxUtxos.find((u) => u.output?.scriptHash) ?? pelletTxUtxos[0];
    const pelletScriptHash = pelletUtxo?.output?.scriptHash;
    if (!pelletScriptHash) throw new Error("Cannot find pellet scriptHash in pellet tx outputs");

    const asteria = applyParamtoAsteria(
      scriptHash(pelletScriptHash),
      admin_token,
      ship_mint_lovelace_fee,
      max_asteria_mining,
      min_asteria_distance,
      initial_fuel
    );

    const deployScript = applyParamtoDeploy(admin_token);
    const deployScriptAddressBech32 = resolvePlutusScriptAddress(deployScript.plutusScript, 0);

    const onChainUtxos = await providerForTx.fetchAddressUTxOs(changeAddress);
    let utxoToUse = selectedUtxo ?? onChainUtxos.find((u) => u.input?.txHash !== pelletRef.txHash) ?? onChainUtxos[0];

    const asteriaAsset: Asset[] = [{ unit: "lovelace", quantity: "30615530" }];

    const txBuilder = new MeshTxBuilder({
      fetcher: providerForTx,
      submitter: providerForTx,
      verbose: true,
    });

    const unsignedTx = await txBuilder
      .txOut(deployScriptAddressBech32, asteriaAsset)
      .txOutInlineDatumValue(conStr0([]), "JSON")
      .txOutReferenceScript(asteria.cborScript, "V3")
      .selectUtxosFrom([utxoToUse])
      .changeAddress(changeAddress)
      .setNetwork("preprod")
      .complete();

    const signedTx = await myWallet.signTx(unsignedTx, true);
    const txHash = await myWallet.submitTx(signedTx);

    await waitForUtxo(txHash);

    // Save txHash + deploy address
    await writeScriptRefJson("asteriaref", txHash, deployScriptAddressBech32);
    console.log("✅ Asteria deployed. TX hash:", txHash);

    return txHash;
  } catch (err) {
    console.error("❌ deployAsteria error:", err);
    throw err;
  }
}
