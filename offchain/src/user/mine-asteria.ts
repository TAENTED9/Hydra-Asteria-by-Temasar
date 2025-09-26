import {
  Asset,
  conStr0,
  conStr1,
  conStr2,
  deserializeDatum,
  integer,
  MeshTxBuilder,
  PlutusScript,
  policyId,
  stringToHex,
  UTxO,
} from "@meshsdk/core";
import {
  blockchainProvider,
  myWallet,
  readScripRefJson,
  tx_earliest_slot,
} from "../../utils.js";
import { fromScriptRef, resolvePlutusScriptAddress } from "@meshsdk/core-cst";
import { admintoken, max_asteria_mining } from "../../config.js";

const changeAddress = await myWallet.getChangeAddress();
const collateral: UTxO = (await myWallet.getCollateral())[0]!;
const utxos = await myWallet.getUtxos();

async function mineAsteria(ship_tx_hash: string) {
  const spacetimeDeployScript = await readScripRefJson("spacetimeref");
  if (!spacetimeDeployScript.txHash) throw Error("Spacetime script-ref not found, deploy spacetime first.");

  const pelletDeployScript = await readScripRefJson("pelletref");
  if (!pelletDeployScript.txHash) throw Error("Pellet script-ref not found, deploy pellet first.");

  const asteriaDeployScript = await readScripRefJson("asteriaref");
  if (!asteriaDeployScript.txHash) throw Error("Asteria script-ref not found, deploy asteria first.");

  const spacetime_scriptref_utxo = await blockchainProvider.fetchUTxOs(spacetimeDeployScript.txHash);
  const shipyard_policyId = spacetime_scriptref_utxo[0].output.scriptHash;

  const pellet_scriptref_utxo = await blockchainProvider.fetchUTxOs(pelletDeployScript.txHash);
  const fuel_policyid = pellet_scriptref_utxo[0].output.scriptHash;

  const asteria_scriptref_utxos = await blockchainProvider.fetchUTxOs(asteriaDeployScript.txHash);
  const asteria_script_ref = fromScriptRef(asteria_scriptref_utxos[0].output.scriptRef!);
  const asteria_plutus_script = asteria_script_ref as PlutusScript;
  const asteria_script_address = resolvePlutusScriptAddress(asteria_plutus_script, 0);

  const ship_utxo = await blockchainProvider.fetchUTxOs(ship_tx_hash, 1);
  const ship = ship_utxo[0];
  if (!ship.output.plutusData) throw Error("Ship datum not found");

  const shipInputFuel = ship.output.amount.find(
    asset => asset.unit === fuel_policyid + stringToHex("FUEL")
  );

  const asteria_utxo = await blockchainProvider.fetchAddressUTxOs(
    asteria_script_address,
    admintoken.policyid + admintoken.name
  );
  const asteria = asteria_utxo[0];
  if (!asteria.output.plutusData) throw Error("Asteria datum not found");

  const rewardAda = asteria.output.amount.find(asset => asset.unit === "lovelace");

  // Input ship datum
  const shipInputDatum = deserializeDatum(ship.output.plutusData!).fields;
  const ship_datum_posX: number = shipInputDatum[0].int;
  const ship_datum_posY: number = shipInputDatum[1].int;
  const ship_datum_shipTokenName: string = shipInputDatum[2].bytes;
  const ship_datum_pilotTokenName: string = shipInputDatum[3].bytes;
  const ship_datum_LastMoveLatestTime: number = shipInputDatum[4].int;

  // Input asteria datum
  const asteriaInputDatum = deserializeDatum(asteria.output.plutusData!).fields;
  const asteria_datum_shipcounter = asteriaInputDatum[0].int;
  const asteria_datum_shipyard_policy = asteriaInputDatum[1].bytes;

  const asteriaOutputDatum = conStr0([
    integer(asteria_datum_shipcounter),
    policyId(asteria_datum_shipyard_policy),
  ]);

  // ✅ Fixed: type-safe number handling
  const shipFuel = Number(shipInputFuel?.quantity ?? 0);
  const totalReward = Number(rewardAda?.quantity ?? 0);

  // mined reward is a percentage of total reward
  const minedReward = Math.floor(totalReward * max_asteria_mining) / 100;

  // Assets
  const asteria_address_assets: Asset[] = [
    { unit: admintoken.policyid + admintoken.name, quantity: "1" },
    { unit: "lovelace", quantity: (totalReward - minedReward).toString() },
  ];

  const pilotAssets: Asset[] = [
    { unit: shipyard_policyId + ship_datum_pilotTokenName, quantity: "1" },
    { unit: "lovelace", quantity: minedReward.toString() },
  ];

  // Redeemers
  const shipRedemmer = conStr2([]);
  const asteriaRedeemer = conStr1([]);
  const burnShipRedeemer = conStr1([]);
  const burnfuelRedeemer = conStr1([]);

  const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    evaluator: blockchainProvider,
    verbose: true,
  });

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(asteria.input.txHash, asteria.input.outputIndex)
    .spendingReferenceTxInRedeemerValue(asteriaRedeemer, "JSON")
    .spendingTxInReference(asteriaDeployScript.txHash, 0)
    .txInInlineDatumPresent()
    .txOut(asteria_script_address, asteria_address_assets)
    .txOutInlineDatumValue(asteriaOutputDatum, "JSON")

    .spendingPlutusScriptV3()
    .txIn(ship.input.txHash, ship.input.outputIndex)
    .spendingReferenceTxInRedeemerValue(shipRedemmer, "JSON")
    .spendingTxInReference(spacetimeDeployScript.txHash, 0)
    .txInInlineDatumPresent()

    .mintPlutusScriptV3()
    .mint("-1", shipyard_policyId!, ship_datum_shipTokenName)
    .mintTxInReference(spacetimeDeployScript.txHash, 0)
    .mintRedeemerValue(burnShipRedeemer, "JSON")

    .mintPlutusScriptV3()
    .mint("-" + shipFuel, fuel_policyid!, stringToHex("FUEL"))
    .mintTxInReference(pelletDeployScript.txHash, 0)
    .mintRedeemerValue(burnfuelRedeemer, "JSON")

    .txOut(myWallet.addresses.baseAddressBech32!, pilotAssets)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .invalidBefore(tx_earliest_slot())
    .selectUtxosFrom(utxos)
    .changeAddress(changeAddress)
    .setNetwork("preprod")
    .complete();

  const signedTx = await myWallet.signTx(unsignedTx);
  const txHash = await myWallet.submitTx(signedTx);
  return txHash;
}

export { mineAsteria };
