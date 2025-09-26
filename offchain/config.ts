//offchain/config.ts
import { stringToHex } from "@meshsdk/core";

export const admintoken = {
  policyid: "b1c4161244ba39de0bdbec6131b931252cc0369b84fa345a99576a02", 
  name:      stringToHex("hydra-asteria")
};

export const prizeToken = {
    policyId: "",
    name: stringToHex("")
};

export const fuelToken = {
    policyId: "",
    name: stringToHex("FUEL")
};

export const max_speed = {
    distance: 1,
    time: 30 * 1000
};
export const ship_mint_lovelace_fee: number = 3000000;
export const max_asteria_mining: number = 50;
export const max_ship_fuel: number = 300;
export const initial_fuel: string = "100";
export const min_asteria_distance: number = 10;
export const fuel_per_step: number = 10;