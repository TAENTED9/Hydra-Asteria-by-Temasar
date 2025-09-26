import { 
  Integer, 
  PlutusScript, 
  ScriptHash
} from "@meshsdk/core";
import { applyParamsToScript } from "@meshsdk/core-cst";
import plutusBlueprint from "../../../plutus.json" with {type: 'json'};

const asteriaValidator = plutusBlueprint.validators.find(
        ({ title }) => title === "asteria.asteria.spend"
  );
const ASTERIA_SCRIPT = asteriaValidator!.compiledCode;

function applyParamtoAsteria(
  pelletScriptAddress: ScriptHash,
  admin_token:any,
  ship_mint_lovelace_fee:Integer,
  max_asteria_mining: Integer,
  min_asteria_distance: Integer,
  initial_fuel: Integer
  ){
  const cborScript = applyParamsToScript(
     ASTERIA_SCRIPT,
      [
        pelletScriptAddress,
        admin_token,
        ship_mint_lovelace_fee,
        max_asteria_mining,
        min_asteria_distance,
        initial_fuel
      ],
    "JSON"
  );

    const PlutusScript: PlutusScript = {
      code: cborScript,
      version: "V3"
    };

  return { PlutusScript, cborScript};
};

export{applyParamtoAsteria};