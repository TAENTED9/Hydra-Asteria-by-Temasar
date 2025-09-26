import { applyParamsToScript } from "@meshsdk/core-cst";
import plutusBlueprint from "../../../plutus.json" with {type: 'json'};
import { PlutusScript } from "@meshsdk/core";
    
const pelletValidator = plutusBlueprint.validators.find(
 ({ title }) => title === "pellet.pellet.spend"
);
        
const PELLET_SCRIPT = pelletValidator!.compiledCode;

function  applyParamtoPellet(admin_token:any){
  const cborScript  = applyParamsToScript(
    PELLET_SCRIPT,
    [admin_token],
    "JSON"
  );

  const PlutusScript: PlutusScript = {
    code: cborScript,
    version: "V3"
    };
  return {PlutusScript, cborScript};
};
                      
export {applyParamtoPellet};