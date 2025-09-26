import { blockchainProvider, myWallet, readScripRefJson } from "../../utils.js";
import {
  conStr1,
  conStr3,
  deserializeDatum,
  MeshTxBuilder,
  stringToHex,
  UTxO,
} from "@meshsdk/core";

const changeAddress = await myWallet.getChangeAddress();
const collateral: UTxO = (await myWallet.getCollateral())[0]!;
const utxos = await myWallet.getUtxos();

async function quit(ship_tx_hash: string) {
  const spacetimeDeployScript = await readScripRefJson("spacetimeref");
  if (!spacetimeDeployScript.txHash) {
    throw Error("spacetime script-ref not found, deploy spacetime first.");
  }
  const pelletDeployScript = await readScripRefJson("pelletref");
  if (!pelletDeployScript.txHash) {
    throw Error("pellet script-ref not found, deploy pellet first.");
  }

  const spacetime_scriptref_utxo = await blockchainProvider.fetchUTxOs(
    spacetimeDeployScript.txHash
  );
  const shipyard_policyid = spacetime_scriptref_utxo[0].output.scriptHash;

  const pellet_scriptref_utxo = await blockchainProvider.fetchUTxOs(
    pelletDeployScript.txHash
  );
  const fuel_policyId = pellet_scriptref_utxo[0].output.scriptHash;
  const fuelTokenName = stringToHex("FUEL");

  const shipUtxos = await blockchainProvider.fetchUTxOs(ship_tx_hash, 0);

  const ship = shipUtxos[0];
  if (!ship.output.plutusData) {
    throw new Error("ship datum not found");
  }
  const shipInputFuel = ship.output.amount.find(
    (Asset) => Asset.unit == fuel_policyId + fuelTokenName
  );
  if (!shipInputFuel) {
    throw new Error("ship input Fuel not found");
  }

  const shipInputData = ship.output.plutusData;
  const shipInputDatum = deserializeDatum(shipInputData!).fields;
  const shipFuel = shipInputFuel?.quantity;

  const ship_datum_PosX: number = shipInputDatum[0].int;
  const ship_datum_PosY: number = shipInputDatum[1].int;
  const ship_datum_ShipTokenName: string = shipInputDatum[2].bytes;
  const ship_datum_PilotTokenName: string = shipInputDatum[3].bytes;
  const ship_datumLastMoveLatestTime: number = shipInputDatum[4].int;

  const burnShipRedeemer = conStr1([]);
  const burnfuelRedeemer = conStr1([]);
  const quitRedeemer = conStr3([]);

  const txbuilder = new MeshTxBuilder({
    submitter: blockchainProvider,
    fetcher: blockchainProvider,
    evaluator: blockchainProvider,
    verbose: true,
  });
  console.log("ship fuel", shipFuel);
  const unsignedTx = await txbuilder
    .spendingPlutusScriptV3()
    .txIn(ship.input.txHash, ship.input.outputIndex)
    .txInRedeemerValue(quitRedeemer, "JSON")
    .txInInlineDatumPresent()
    .spendingTxInReference(spacetimeDeployScript.txHash, 0)

    .mintPlutusScriptV3()
    .mint("-1", shipyard_policyid!, ship_datum_ShipTokenName)
    .mintTxInReference(spacetimeDeployScript.txHash, 0)
    .mintRedeemerValue(burnShipRedeemer, "JSON")
    .mintPlutusScriptV3()
    .mint("-" + shipFuel, fuel_policyId!, fuelTokenName)
    .mintTxInReference(pelletDeployScript.txHash, 0)
    .mintRedeemerValue(burnfuelRedeemer, "JSON")

    .txOut(myWallet.addresses.baseAddressBech32!, [
      {
        unit: shipyard_policyid + ship_datum_PilotTokenName,
        quantity: "1",
      },
    ])
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .changeAddress(changeAddress)
    .selectUtxosFrom(utxos)
    .setNetwork("preprod")
    .complete();

  const signedTx = await myWallet.signTx(unsignedTx);
  const txhash = await myWallet.submitTx(signedTx);
  return txhash;
}

export { quit };
