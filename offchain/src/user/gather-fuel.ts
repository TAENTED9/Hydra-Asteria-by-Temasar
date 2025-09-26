import { 
    Asset, 
    byteString, 
    conStr, 
    conStr0, 
    conStr1, 
    deserializeDatum, 
    integer, 
    mConStr0, 
    mConStr1, 
    MeshTxBuilder, 
    PlutusScript, 
    policyId, 
    serializePlutusScript, 
    stringToHex, 
    UTxO
} from "@meshsdk/core";
import { 
    blockchainProvider, 
    myWallet, 
    readScripRefJson
} from "../../utils.js";
import { fromScriptRef } from "@meshsdk/core-cst";
import { admintoken } from "../../config.js";
import { tx_earliest_slot } from "../../utils.js";

const changeAddress = await myWallet.getChangeAddress();
const collateral: UTxO = (await myWallet.getCollateral())[0]!;
const utxos = await myWallet.getUtxos();

async function gatherFuel(
    ship_tx_hash: string,
    pellet_tx_Hash: string,
    pellet_tx_index: number,
) {
    const spacetimeDeployScript = await readScripRefJson('spacetimeref');
    if (!spacetimeDeployScript.txHash) {
        throw Error("Spacetime script-ref not found, deploy spacetime first.");
    }

    const pelletDeployScript = await readScripRefJson('pelletref');
    if (!pelletDeployScript.txHash) {
        throw Error("Pellet script-ref not found, deploy pellet first.");
    }

    const spacetimeUtxos = await blockchainProvider.fetchUTxOs(spacetimeDeployScript.txHash);
    const spacetimeScriptRef = fromScriptRef(spacetimeUtxos[0].output.scriptRef!);
    const spacetimePlutusScript = spacetimeScriptRef as PlutusScript;
    const spacetimeAddress = serializePlutusScript(spacetimePlutusScript).address;
    const shipYardPolicyId = spacetimeUtxos[0].output.scriptHash;

    const pelletUtxos = await blockchainProvider.fetchUTxOs(pelletDeployScript.txHash);
    const pelletScriptRef = fromScriptRef(pelletUtxos[0].output.scriptRef!);
    const pelletPlutusScript = pelletScriptRef as PlutusScript;
    const pelletAddress = serializePlutusScript(pelletPlutusScript).address;
    const fuelPolicyId = pelletUtxos[0].output.scriptHash;

    const shipUtxo = await blockchainProvider.fetchUTxOs(ship_tx_hash, 0);
    const pelletUtxo = await blockchainProvider.fetchUTxOs(pellet_tx_Hash, pellet_tx_index);

    const ship = shipUtxo[0];
    if (!ship.output.plutusData) throw Error("Ship datum is empty");

    const pellet = pelletUtxo[0];
    if (!pellet.output.plutusData) throw Error("Pellet datum is empty");

    // Get input Ada value
    const shipInputAda = ship.output.amount.find(asset => asset.unit === "lovelace");
    const fueltokenUnit = fuelPolicyId + stringToHex("FUEL");
    const shipInputFuel = ship.output.amount.find(asset => asset.unit === fueltokenUnit);
    const pelletInputAda = pellet.output.amount.find(asset => asset.unit === "lovelace");
    const pelletInputFuel = pellet.output.amount.find(asset => asset.unit === fueltokenUnit);

    console.log("Ship input ada:", shipInputAda);
    console.log("Pellet input ada:", pelletInputAda);

    // Ensure gather_amount is a number
    const gather_amount = Number(pelletInputFuel?.quantity ?? 0);

    // Ship datum
    const shipInputDatum = deserializeDatum(ship.output.plutusData).fields;
    const ShipPosX: number = shipInputDatum[0].int;
    const shipPoxY: number = shipInputDatum[1].int;
    const shipTokenName: string = shipInputDatum[2].bytes;
    const pilotTokenName: string = shipInputDatum[3].bytes;
    const lastMoveLatestTime: number = shipInputDatum[4].int;

    const shipOutDatum = conStr0([
        integer(ShipPosX),
        integer(shipPoxY),
        byteString(shipTokenName),
        byteString(pilotTokenName),
        integer(lastMoveLatestTime),
    ]);

    // Pellet datum
    const pelletInputDatum = deserializeDatum(pellet.output.plutusData).fields;
    const pelletPosX: number = pelletInputDatum[0].int;
    const pelletPosY: number = pelletInputDatum[1].int;
    const pelletInputShipyardPolicy: string = pelletInputDatum[2].bytes;

    const pelletOuputDatum = conStr0([
        integer(pelletPosX),
        integer(pelletPosY),
        policyId(pelletInputShipyardPolicy)
    ]);

    // Assets
    const shipFuel = shipInputFuel?.quantity;
    const spacetimeOutputAssets: Asset[] = [
        { unit: shipInputAda?.unit!, quantity: shipInputAda?.quantity! },
        { unit: shipYardPolicyId + shipTokenName, quantity: "1" },
        { unit: pelletInputFuel?.unit!, quantity: (Number(shipFuel ?? 0) + gather_amount).toString() },
    ];

    const pelletOutputAssets: Asset[] = [
        { unit: admintoken.policyid + admintoken.name, quantity: "1" },
        { unit: pelletInputFuel?.unit!, quantity: (0 - gather_amount).toString() },
    ];

    const pilot_token_asset: Asset[] = [
        { unit: shipYardPolicyId + pilotTokenName, quantity: "1" }
    ];

    const shipRedeemer = conStr(1, [integer(gather_amount)]);
    const pelletRedemer = conStr0([integer(gather_amount)]);

    const txBuilder = new MeshTxBuilder({
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        evaluator: blockchainProvider,
        verbose: true
    });

    const unsignedTx = await txBuilder
        .spendingPlutusScriptV3()
        .txIn(pellet.input.txHash, pellet.input.outputIndex)
        .txInRedeemerValue(pelletRedemer, "Mesh", { mem: 50000000, steps: 10000000000 })
        .spendingTxInReference(pelletDeployScript.txHash, 0)
        .txInInlineDatumPresent()
        .txOut(spacetimeAddress, spacetimeOutputAssets)
        .txOutInlineDatumValue(shipOutDatum, "JSON")

        .spendingPlutusScriptV3()
        .txIn(ship.input.txHash, ship.input.outputIndex)
        .txInRedeemerValue(shipRedeemer, "JSON", { mem: 50000000, steps: 10000000000 })
        .spendingTxInReference(spacetimeDeployScript.txHash, 0)
        .txInInlineDatumPresent()
        .txOut(pelletAddress, pelletOutputAssets)
        .txOutInlineDatumValue(pelletOuputDatum, "JSON")

        .txOut(myWallet.addresses.baseAddressBech32!, pilot_token_asset)
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

export { gatherFuel };
