import { createPellet } from "./create-pellet.js";
import { writeFile } from "fs/promises";
import { writePelletsCsvFIle } from "./utils.js";
import { __dirname } from "./utils.js";
import { join } from "node:path";

async function createPelletTest(number_of_pellets: number){
let pellets: { posX: number; posY: number; fuel: string }[] = [];
let totalFuel = 0;
        function generateRandomFuelProperty() {
            const posX = Math.floor(Math.random() * 101) - 50;
            const posY = Math.floor(Math.random() * 101) - 50;
            const fuel = (Math.floor(Math.random() * (200 - 50 + 1)) + 50).toString();
        return {fuel, posX, posY};
    };
    for(let i = 0; i < number_of_pellets; i++){
        const {posX, posY, fuel} = generateRandomFuelProperty();
        const pelletProperty = {
            posX,
            posY,
            fuel
        };
        pellets.push(pelletProperty);
        totalFuel += parseInt(fuel, 10); // Accumulate the fuel value
    }

writePelletsCsvFIle(pellets);
const txHash = await createPellet(
    pellets,
    totalFuel.toString()
);

await writeFile(join(__dirname, 'pellets.json'), JSON.stringify({txHash: txHash }));
return txHash;
}
export {createPelletTest};