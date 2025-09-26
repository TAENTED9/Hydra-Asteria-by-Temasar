import "dotenv/config";
import { deployPellet } from "./pellet.js";
import { deployAsteria } from "./asteria.js";
import { deploySpacetime } from "./spacetime.js";

async function main() {
  try {
    console.log("🟢 Starting full deployment...");

    console.log("\n🚀 Deploying Pellet...");
    const pelletTx = await deployPellet();
    console.log("✅ Pellet deployed successfully. TX hash:", pelletTx);

    console.log("\n🚀 Deploying Asteria...");
    const asteriaTx = await deployAsteria();
    console.log("✅ Asteria deployed successfully. TX hash:", asteriaTx);

    console.log("\n🚀 Deploying Spacetime...");
    const spacetimeTx = await deploySpacetime();
    console.log("✅ Spacetime deployed successfully. TX hash:", spacetimeTx);

    console.log("\n🎉 All scripts deployed successfully!");
    return { pelletTx, asteriaTx, spacetimeTx };
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1); // Exit with error code for CI/CD or npm run deploy
  }
}

main();
