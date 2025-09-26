import { applyParamsToScript} from "@meshsdk/core-cst";
import plutusBlueprint from "../../../plutus.json" with {type: 'json'};
import { Integer, PlutusScript, ScriptHash} from "@meshsdk/core";

const asteriaValidator = plutusBlueprint.validators.find(
        ({ title }) => title === "spacetime.spacetime.spend"
    );

const SPACETIME_SCRIPT = asteriaValidator!.compiledCode;

function applyParamtoSpacetime (
   pelletScriptAddress:ScriptHash,
   asteriaScriptAddress:ScriptHash,
   admin_token:any,
   max_speed:any,
   max_ship_fuel:Integer,
   fuel_per_step: Integer
){
    const cborScript = applyParamsToScript(
        SPACETIME_SCRIPT!,
        [   pelletScriptAddress,
            asteriaScriptAddress,
            admin_token,
            max_speed,
            max_ship_fuel,
            fuel_per_step
        ],
     "JSON"
    );

    const plutusScript: PlutusScript = {
        code: cborScript,
        version: "V3"
    };
    return {plutusScript,cborScript};
};

export {applyParamtoSpacetime};