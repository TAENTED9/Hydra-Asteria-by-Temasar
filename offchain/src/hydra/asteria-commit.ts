import { blockchainProvider, myWallet, readScripRefJson } from "../../utils.js";
import { admintoken } from "../../config.js";
import { conStr2, MeshTxBuilder } from "@meshsdk/core";
import { HydraInstance, HydraProvider } from "@meshsdk/hydra";

const utxos = await myWallet.getUtxos();
const changeAddress = await myWallet.getChangeAddress();
const collateral = (await myWallet.getCollateral())[0]!;

const commit_asteria_utxo = async (
  asteriaUtxo: { txHash: string; txIndex: number },
  hydra_url: string
) => {
  const hydraProvider = new HydraProvider({ url: hydra_url });
  const hydraInstance = new HydraInstance({
    provider: hydraProvider,
    fetcher: blockchainProvider as any,
    submitter: blockchainProvider,
  });

  const asteriaDeployScript = await readScripRefJson("asteriaref");
  if (!asteriaDeployScript.txHash) {
    throw Error("asteria script-ref not found, deploy asteria first.");
  }

  const asteriaUtxos = await blockchainProvider.fetchUTxOs(
    asteriaUtxo.txHash,
    asteriaUtxo.txIndex
  );
  const asteria = asteriaUtxos[0];

  const adminTokenUnit = admintoken.policyid + admintoken.name;
  const adminUTxOs = await myWallet.getUtxos().then((us: any) =>
    us.filter((u: any) =>
      u.output.amount.find((Asset: any) => Asset.unit === adminTokenUnit)
    )
  );
  const adminUtxo = adminUTxOs[0];
  const consumeRedeemer = conStr2([]);

  const txBuilder = new MeshTxBuilder({
    submitter: blockchainProvider,
    fetcher: blockchainProvider,
    verbose: true,
  });

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(asteria.input.txHash, asteria.input.outputIndex)
    .txInRedeemerValue(consumeRedeemer, "JSON")
    .txInInlineDatumPresent()
    .spendingTxInReference(asteriaDeployScript.txHash, 0)
    .txIn(adminUtxo.input.txHash, adminUtxo.input.outputIndex)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(utxos)
    .setNetwork("preprod")
    .changeAddress(changeAddress)
    .complete();

  const tx = await hydraInstance.commitBlueprint();

  const signedTx = await myWallet.signTx(tx, true);
  const txHash = await myWallet.submitTx(signedTx);
  return txHash;
};

export { commit_asteria_utxo };
