import { applyParamsToScript } from "@meshsdk/core-cst";
import plutusBlueprint from "../../../plutus.json" with {type: 'json'};
import { PlutusScript } from "@meshsdk/core";

const asteriaValidator = plutusBlueprint.validators.find(
        ({ title }) => title === "deploy.deploy.spend"
  );

const DEPLOY_SCRIPT = asteriaValidator!.compiledCode;

function applyParamtoDeploy( admin_token:any){
    const cborScript   = applyParamsToScript(
      DEPLOY_SCRIPT,
      [admin_token],
      "JSON"
    );

  const plutusScript : PlutusScript = {
    code: cborScript,
    version: "V3"
  };
return {cborScript,plutusScript};
};

export {applyParamtoDeploy};