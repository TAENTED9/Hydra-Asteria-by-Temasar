import { conStr0, MeshTxBuilder, serializePlutusScript } from "@meshsdk/core";
import { admin_token } from "../../const";
import { applyParamtoDeploy } from "../admin/apply-param/deploy";
import { blockchainProvider, maestroprovider, myWallet } from "../../utils";
import { admintoken } from "../../config";
import { HydraInstance, HydraProvider } from "@meshsdk/hydra";

const utxos = await myWallet.getUtxos();
const changeAddress = await myWallet.getChangeAddress();
const collateral = (await myWallet.getCollateral())[0]!;

async function commit_scriptref_utxo(deploy_txhash: string, hydra_url: string) {
  const hydraProvider = new HydraProvider({ url: hydra_url });
  const hydraInstance = new HydraInstance({
    provider: hydraProvider,
    fetcher: blockchainProvider as any,
    submitter: blockchainProvider,
  });

  const scriptref_plutusScript = applyParamtoDeploy(admin_token).plutusScript;
  const scriptref_cborScript = applyParamtoDeploy(admin_token).cborScript;
  const scriptref_address = serializePlutusScript(scriptref_plutusScript, "", 0).address;
  const scriptref_utxos = await blockchainProvider.fetchAddressUTxOs(scriptref_address);
  if (!scriptref_utxos) throw new Error("scriptref UTxO not found");

  const adminTokenUnit = admintoken.policyid + admintoken.name;
  const adminUTxOs = await myWallet.getUtxos().then(us =>
    us.filter(u => u.output.amount.find(Asset => Asset.unit === adminTokenUnit))
  );
  const adminUtxo = adminUTxOs[0];

  const txBuilder = new MeshTxBuilder({
    submitter: blockchainProvider,
    fetcher: blockchainProvider,
    evaluator: maestroprovider,
  });

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(deploy_txhash, 0)
    .txInRedeemerValue(conStr0([]), "JSON")
    .txInInlineDatumPresent()
    .txInScript(scriptref_cborScript)
    .txIn(adminUtxo.input.txHash, adminUtxo.input.outputIndex)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(utxos)
    .changeAddress(changeAddress)
    .setNetwork("preprod")
    .complete();

  const tx = await hydraInstance.commitBlueprint();
  const signedTx = await myWallet.signTx(tx, true);
  const txhash = await myWallet.submitTx(signedTx);
  return txhash;
}

export { commit_scriptref_utxo };
