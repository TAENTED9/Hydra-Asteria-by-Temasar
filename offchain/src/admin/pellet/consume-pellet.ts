import { conStr1, MeshTxBuilder, stringToHex, UTxO } from "@meshsdk/core";
import {
  blockchainProvider,
  maestroprovider,
  myWallet,
  readScripRefJson,
} from "../../../utils.js";
import { admintoken } from "../../../config.js";

const changeAddress = await myWallet.getChangeAddress();
const collateral: UTxO = (await myWallet.getCollateral())[0]!;
const utxos = await myWallet.getUtxos();

const consumePellets = async (pelletTxhash: string) => {
  const pelletDeployScript = await readScripRefJson("pelletref");
  if (!pelletDeployScript.txHash) {
    throw Error("pellet script-ref not found, deploy pellet first.");
  }

  const pellet_scriptref_utxo = await maestroprovider.fetchUTxOs(
    pelletDeployScript.txHash
  );
  const fuel_policyId = pellet_scriptref_utxo[0].output.scriptHash;
  const fuelTokenName = stringToHex("FUEL");

  const pelletsUtxo = await maestroprovider.fetchUTxOs(pelletTxhash);

  //skip last unused input index
  const pellets = pelletsUtxo.slice(0, -1).map((utxo, index) => ({
    input: {
      txHash: pelletTxhash,
      outputIndex: index,
    },
    output: utxo.output,
  }));

  const totalFuel = pellets.reduce((sum, pellet) => {
    const asset = pellet.output.amount.find(
      (asset) => asset.unit === fuel_policyId + fuelTokenName
    );
    return sum + (Number(asset?.quantity) || 0);
  }, 0);

  const addressUtxos = await myWallet
    .getUtxos()
    .then((us) =>
      us.filter((u) =>
        u.output.amount.find(
          (asset) => asset.unit === admintoken.policyid + admintoken.name
        )
      )
    )
    .then((us) => us[0]);

  const consumePelletRedeemer = conStr1([]);
  const burnfuelRedeemer = conStr1([]);

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
    .mintPlutusScriptV3()
    .mint("-" + totalFuel.toString(), fuel_policyId!, fuelTokenName)
    .mintTxInReference(pelletDeployScript.txHash, 0)
    .mintRedeemerValue(burnfuelRedeemer, "JSON")

    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .setNetwork("preprod")
    .changeAddress(changeAddress)
    .selectUtxosFrom(utxos);

  const unsignedTx = await txbuilder.complete();
  const signedTx = await myWallet.signTx(unsignedTx);
  const txhash = await myWallet.submitTx(signedTx);
  return txhash;
};

export { consumePellets };
