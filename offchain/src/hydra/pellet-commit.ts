import { conStr1, MeshTxBuilder, stringToHex, UTxO } from "@meshsdk/core";
import { blockchainProvider, maestroprovider, myWallet, readScripRefJson } from "../../utils.js";
import { admintoken } from "../../config.js";
import { HydraInstance, HydraProvider } from "@meshsdk/hydra";

const changeAddress = await myWallet.getChangeAddress();
const collateral: UTxO = (await myWallet.getCollateral())[0]!;
const utxos = await myWallet.getUtxos();

const commit_pellets_utxos = async (
  pelletTxhash: string,
  hydra_url: string
) => {
  const hydraProvider = new HydraProvider({ url: hydra_url });
  const hydraInstance = new HydraInstance({
    provider: hydraProvider,
    fetcher: blockchainProvider as any,
    submitter: blockchainProvider,
  });

  const pelletDeployScript = await readScripRefJson("pelletref");
  if (!pelletDeployScript.txHash) throw Error("pellet script-ref not found.");

  const pellet_scriptref_utxo = await maestroprovider.fetchUTxOs(pelletDeployScript.txHash);
  const fuel_policyId = pellet_scriptref_utxo[0].output.scriptHash;
  const fuelTokenName = stringToHex("FUEL");

  const pelletsUtxo = await maestroprovider.fetchUTxOs(pelletTxhash);
  const pellets = pelletsUtxo.slice(0, -1).map((utxo, index) => ({
    input: { txHash: pelletTxhash, outputIndex: index },
    output: utxo.output,
  }));

  const totalFuel = pellets.reduce((sum, pellet) => {
    const asset = pellet.output.amount.find(asset => asset.unit === fuel_policyId + fuelTokenName);
    return sum + (Number(asset?.quantity) || 0);
  }, 0);

  console.log("total Fuel", totalFuel);

  const addressUtxos = await myWallet.getUtxos().then(us =>
    us.filter(u =>
      u.output.amount.find(asset => asset.unit === admintoken.policyid + admintoken.name)
    )[0]
  );

  const consumePelletRedeemer = conStr1([]);
  const txbuilder = new MeshTxBuilder({
    submitter: blockchainProvider,
    fetcher: blockchainProvider,
    evaluator: blockchainProvider,
    verbose: true,
  });

  for (const pellet of pellets) {
    txbuilder
      .spendingPlutusScriptV3()
      .txIn(pellet.input.txHash, pellet.input.outputIndex)
      .txInInlineDatumPresent()
      .spendingTxInReference(pelletDeployScript.txHash, 0)
      .txInRedeemerValue(consumePelletRedeemer, "JSON");
  }

  txbuilder
    .txIn(addressUtxos.input.txHash, addressUtxos.input.outputIndex)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .setNetwork("preprod")
    .changeAddress(changeAddress)
    .selectUtxosFrom(utxos);

  const unsignedTx = await txbuilder.complete();
  const pellet_commit_hash: string[] = [];

  for (const pellet of pellets) {
    const tx = await hydraInstance.commitBlueprint();
    const signedTx = await myWallet.signTx(tx);
    const txhash = await myWallet.submitTx(signedTx);
    pellet_commit_hash.push(txhash);
  }

  return pellet_commit_hash;
};

export { commit_pellets_utxos };
