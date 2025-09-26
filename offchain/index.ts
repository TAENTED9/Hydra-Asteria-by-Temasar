//index.ts
import { CardanoSubmitClient } from "@utxorpc/sdk";
import { createPelletTest } from "./src/admin/pellet/create-pellet-test.js";
import { createShip } from "./src/user/create-ship.js";
import { moveShip } from "./src/user/move-ship.js";
import { quit } from "./src/user/quit.js";
import { consumePellets } from "./src/admin/pellet/consume-pellet.js";
import { gatherFuel } from "./src/user/gather-fuel.js";


//const txHash = await moveShip(2,1,"f84b61cf88ce198781feb1409803cb618af4bfa186e031aeccb58632832d0ceb");
//const txHash = await createPelletTest(5);
//const txHash = await createShip(14,30);
const txHash = await gatherFuel("ff689c0e0826e0bf62ed893cec4aa2ecc72580c2eb953cadb5edc60d5f370935","9b48ac9d761f3e8e990404d0cad15e2e351e53299e22c04842df71ad68a690ed",1)

//const txHash = await consumePellets("1b9d6ab2c74cea07728f8fc96df2227b289374978e8dded0dbc7c24fb6f45dfb")
// const txHash = await quit("d4e6194245a4b36eeed4f79f4df8eb05aa99f92d64bcfaa952ede5430877b087")
console.log(txHash)