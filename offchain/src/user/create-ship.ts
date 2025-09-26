import {
  Asset,
  assetName,
  conStr0,
  deserializeDatum,
  integer,
  MeshTxBuilder,
  PlutusScript,
  policyId,
  posixTime,
  serializePlutusScript,
  SLOT_CONFIG_NETWORK,
  stringToHex,
  unixTimeToEnclosingSlot,
  UTxO,
} from "@meshsdk/core";
import {
  blockchainProvider,
  myWallet,
  readScripRefJson,
} from "../../utils.js";
import { ship_mint_lovelace_fee, initial_fuel } from "../../config.js";
import { admintoken } from "../../config.js";
import { fromScriptRef} from "@meshsdk/core-cst";
import { maestroprovider } from "../../utils.js";

const changeAddress = await myWallet.getChangeAddress();
const collateral: UTxO = (await myWallet.getCollateral())[0]!;
const utxos = await myWallet.getUtxos();

async function createShip(posX: number, posY: number) {
  const asteriaDeployScript = await readScripRefJson("asteriaref");
  if (!asteriaDeployScript.txHash) {
    throw new Error("asteria script-ref not found, deploy asteria first.");
  }
  const spacetimeDeployScript = await readScripRefJson("spacetimeref");
  if (!spacetimeDeployScript.txHash) {
    throw new Error("spacetime script-ref not found, deploy spacetime first.");
  }
  const pelletDeployScript = await readScripRefJson("pelletref");
  if (!pelletDeployScript.txHash) {
    throw new Error("pellet script-ref not found, deploy pellet first.");
  }

  const asteriaScriptRefUtxos = await blockchainProvider.fetchUTxOs(
    asteriaDeployScript.txHash
  );
  const asteriaScriptRef = fromScriptRef(
    asteriaScriptRefUtxos[0].output.scriptRef!
  );
  const asteriaPlutusScript = asteriaScriptRef as PlutusScript;
  const asteriaScriptAddress =
    serializePlutusScript(asteriaPlutusScript).address;
  console.log(asteriaScriptAddress);
  const spacetimeScriptRefUtxos = await blockchainProvider.fetchUTxOs(
    spacetimeDeployScript.txHash
  );
  const shipyardPolicyid = spacetimeScriptRefUtxos[0].output.scriptHash;
  const spacetimeScriptRef = fromScriptRef(
    spacetimeScriptRefUtxos[0].output.scriptRef!
  );
  const spacetimePlutusScript = spacetimeScriptRef as PlutusScript;
  const spacetimeAddress = serializePlutusScript(spacetimePlutusScript).address;

  const pelletScriptRefUtxos = await blockchainProvider.fetchUTxOs(
    pelletDeployScript.txHash
  );
  const fuelPolicyId = pelletScriptRefUtxos[0].output.scriptHash;

  const asteriaInputUtxos = await blockchainProvider.fetchAddressUTxOs(
    asteriaScriptAddress,
    admintoken.policyid + admintoken.name
  );

  const asteria = asteriaInputUtxos[0];
  if (!asteria) {
    throw new Error("create asteria first");
  }
  const asteriaInputAda = asteria.output.amount.find(
    (Asset) => Asset.unit === "lovelace"
  );
  const asteriaInputData = asteria.output.plutusData;
  const asteriaInputDatum = deserializeDatum(asteriaInputData!).fields;

  //datum properties
  const asteriaInputShipcounter = asteriaInputDatum[0].int;
  const asteriaInputShipYardPolicyId = asteriaInputDatum[1].bytes;

  const asteriaOutputDatum = conStr0([
    integer(Number(asteriaInputShipcounter) + 1),
    policyId(asteriaInputShipYardPolicyId),
  ]);

  const fuelTokenName = stringToHex("FUEL");
  const shipTokenName = stringToHex(
    "SHIP" + asteriaInputShipcounter.toString()
  ); 
  const pilotTokenName = stringToHex(
    "PILOT" + asteriaInputShipcounter.toString()
  ); 

  const upperBoundTime = Date.now() + 5 * 60 * 1000;

  const shipDatum = conStr0([
    integer(posX),
    integer(posY),
    assetName(shipTokenName),
    assetName(pilotTokenName),
    posixTime(upperBoundTime),
  ]);

  const tx_latest_slot = unixTimeToEnclosingSlot(
    upperBoundTime,
    SLOT_CONFIG_NETWORK.preprod
  );

  const assetToSpacetimeAddress: Asset[] = [
    {
      unit: shipyardPolicyid! + shipTokenName,
      quantity: "1",
    },
    {
      unit: fuelPolicyId! + fuelTokenName,
      quantity: initial_fuel,
    },
  ];
  const totalRewardsAsset: Asset[] = [
    {
      unit: admintoken.policyid + admintoken.name,
      quantity: "1",
    },
    {
      unit: "lovelace",
      quantity: (
        Number(asteriaInputAda?.quantity) + ship_mint_lovelace_fee
      ).toString(),
    },
  ];
  const pilotTokenAsset: Asset[] = [
    {
      unit: shipyardPolicyid + pilotTokenName,
      quantity: "1",
    },
  ];

  const mintShipRedeemer = conStr0([]);
  const addNewshipRedeemer = conStr0([]);
  const mintFuelRedeemer = conStr0([]);

  const txBuilder = new MeshTxBuilder({
    submitter: blockchainProvider,
    fetcher: maestroprovider,
    evaluator: blockchainProvider,
    verbose: true,
  });

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(asteria.input.txHash, asteria.input.outputIndex)
    .txInRedeemerValue(addNewshipRedeemer, "JSON")
    .spendingTxInReference(asteriaDeployScript.txHash, 0)
    .txInInlineDatumPresent()
    .txOut(asteriaScriptAddress, totalRewardsAsset)
    .txOutInlineDatumValue(asteriaOutputDatum, "JSON")
    .mintPlutusScriptV3()
    .mint("1", shipyardPolicyid!, shipTokenName)
    .mintTxInReference(spacetimeDeployScript.txHash, 0)
    .mintRedeemerValue(mintShipRedeemer, "JSON")
    .mintPlutusScriptV3()
    .mint("1", shipyardPolicyid!, pilotTokenName)
    .mintTxInReference(spacetimeDeployScript.txHash, 0)
    .mintRedeemerValue(mintShipRedeemer, "JSON")
    .mintPlutusScriptV3()
    .mint(initial_fuel, fuelPolicyId!, fuelTokenName)
    .mintTxInReference(pelletDeployScript.txHash, 0)
    .mintRedeemerValue(mintFuelRedeemer, "JSON")

    .txOut(spacetimeAddress, assetToSpacetimeAddress)
    .txOutInlineDatumValue(shipDatum, "JSON")
    .txOut(myWallet.addresses.baseAddressBech32!, pilotTokenAsset)
    .invalidHereafter(tx_latest_slot)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(utxos)
    .changeAddress(changeAddress)
    .setNetwork("preprod")
    .complete();

  const signedTx = await myWallet.signTx(unsignedTx, true);
  const shiptxHash = await myWallet.submitTx(signedTx);
  return shiptxHash;
}
export { createShip };
