import { 
    Asset, 
    byteString, 
    conStr0, 
    conStr1, 
    deserializeDatum, 
    integer,
    MeshTxBuilder, 
    PlutusScript, 
    posixTime, 
    serializePlutusScript, 
    stringToHex,
    UTxO 
} from "@meshsdk/core";
import { 
    blockchainProvider, 
    maestroprovider, 
    myWallet,
    readScripRefJson,
    tx_earliest_slot,
    tx_latest_slot 
} from "../../utils.js";
import { fromScriptRef } from "@meshsdk/core-cst";
import { fuel_per_step } from "../../config.js";

const changeAddress = await myWallet.getChangeAddress();
const collateral: UTxO = (await myWallet.getCollateral())[0]!;
const utxos = await myWallet.getUtxos();

async function moveShip(delta_X: number, delta_Y: number, ship_tx_hash: string) {

    const asteriaDeployScript = await readScripRefJson("asteriaref");
    if (!asteriaDeployScript.txHash) throw new Error("Asteria script-ref not found, deploy asteria first.");

    const spacetimeDeployScript = await readScripRefJson("spacetimeref");
    if (!spacetimeDeployScript.txHash) throw new Error("Spacetime script-ref not found, deploy spacetime first.");

    const pelletDeployScript = await readScripRefJson("pelletref");
    if (!pelletDeployScript.txHash) throw new Error("Pellet script-ref not found, deploy pellet first.");

    const spacetimeUtxos = await blockchainProvider.fetchUTxOs(spacetimeDeployScript.txHash);
    const spacetimeScriptRef = fromScriptRef(spacetimeUtxos[0].output.scriptRef!);
    const spacetimePlutusScript = spacetimeScriptRef as PlutusScript;
    const spacetimeAddress = serializePlutusScript(spacetimePlutusScript).address;
    const shipyardPolicyid = spacetimeUtxos[0].output.scriptHash;

    const pellettUtxos = await blockchainProvider.fetchUTxOs(pelletDeployScript.txHash);
    const fuelPolicyid = pellettUtxos[0].output.scriptHash;

    const shipUtxo = await blockchainProvider.fetchUTxOs(ship_tx_hash, 1);
    const ship = shipUtxo[0];
    if (!ship.output.plutusData) throw Error("Ship datum is empty");

    const shipInputAda = ship.output.amount.find(asset => asset.unit === "lovelace");
    const shipInputFuel = ship.output.amount.find(asset => asset.unit === fuelPolicyid + stringToHex("FUEL"));
    const shipFuel = Number(shipInputFuel?.quantity ?? 0);

    const shipInputDatum = deserializeDatum(ship.output.plutusData!).fields;
    const shipDatumPosX: number = shipInputDatum[0].int;
    const shipDatumPosY: number = shipInputDatum[1].int;
    const shipDatumShipTokenName: string = shipInputDatum[2].bytes;
    const shipDatumPilotTokenName: string = shipInputDatum[3].bytes;
    const shipDatumLastMoveLatestTime: number = shipInputDatum[4].int;

    const ttl = Date.now() + 30 * 60 * 1000;
    const shipOutputDatum = conStr0([
        integer(shipDatumPosX + delta_X),
        integer(shipDatumPosY + delta_Y),
        byteString(shipDatumShipTokenName),
        byteString(shipDatumPilotTokenName),
        posixTime(ttl)
    ]);

    // ✅ Fixed: inline distance and fuel calculation
    const movedDistance = Math.abs(delta_X) + Math.abs(delta_Y);
    const spentFuel = movedDistance * fuel_per_step;

    const assetsToSpacetime: Asset[] = [
        { unit: shipyardPolicyid + shipDatumShipTokenName, quantity: "1" },
        { unit: fuelPolicyid + stringToHex("FUEL"), quantity: (shipFuel - spentFuel).toString() },
    ];

    const pilotTokenAsset: Asset[] = [
        { unit: shipyardPolicyid + shipDatumPilotTokenName, quantity: "1" }
    ];

    const moveShipRedeemer = conStr0([
        integer(delta_X),
        integer(delta_Y)
    ]);

    const burnfuelRedeemer = conStr1([]);

    const txbuilder = new MeshTxBuilder({
        fetcher: maestroprovider,
        submitter: maestroprovider,
        verbose: true
    });

    const unsignedTx = await txbuilder
        .spendingPlutusScriptV3()
        .txIn(ship.input.txHash, ship.input.outputIndex)
        .txInRedeemerValue(moveShipRedeemer, "JSON")
        .spendingTxInReference(spacetimeDeployScript.txHash, 0)
        .txInInlineDatumPresent()
        .txOut(spacetimeAddress, assetsToSpacetime)
        .txOutInlineDatumValue(shipOutputDatum, "JSON")

        .mintPlutusScriptV3()
        .mint((-spentFuel).toString(), fuelPolicyid!, stringToHex("FUEL"))
        .mintTxInReference(pelletDeployScript.txHash, 0)
        .mintRedeemerValue(burnfuelRedeemer, "JSON")

        .txOut(myWallet.addresses.baseAddressBech32!, pilotTokenAsset)
        .invalidBefore(tx_earliest_slot())
        .invalidHereafter(tx_latest_slot())
        .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
        .changeAddress(changeAddress)
        .selectUtxosFrom(utxos)
        .setNetwork("preprod")
        .complete();

    const signedTx = await myWallet.signTx(unsignedTx, true);
    const moveshipTxhash = await myWallet.submitTx(signedTx);
    return moveshipTxhash;
}

export { moveShip };
