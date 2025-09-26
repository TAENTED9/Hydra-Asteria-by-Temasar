import { HydraInstance, HydraProvider } from "@meshsdk/hydra";
import { blockchainProvider, myWallet } from "../../utils.js";
import { MeshTxBuilder } from "@meshsdk/core";

const commit_ordinary = async (
  ordinaryUtxo: { txHash: string; txIndex: number },
  hydra_url: string
) => {
  const hydraProvider = new HydraProvider({ url: hydra_url });
  const hydraInstance = new HydraInstance({
    provider: hydraProvider,
    fetcher: blockchainProvider as any,
    submitter: blockchainProvider,
  });

  const ordinaryUtxos = await blockchainProvider.fetchUTxOs(
    ordinaryUtxo.txHash,
    ordinaryUtxo.txIndex
  );
  const ordinary = ordinaryUtxos[0];

  const changeAddress = await myWallet.getChangeAddress();
  const collateral = (await myWallet.getCollateral())[0]!;
  const utxos = await myWallet.getUtxos();

  const txbuilder = new MeshTxBuilder({
    submitter: blockchainProvider,
    fetcher: blockchainProvider,
    verbose: true,
  });

  const unsignedTx = await txbuilder
    .txIn(ordinary.input.txHash, ordinary.input.outputIndex)
    .txOut(myWallet.addresses.baseAddressBech32!, [
      { unit: "lovelace", quantity: "20000000" },
    ])
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .changeAddress(changeAddress)
    .selectUtxosFrom(utxos)
    .setNetwork("preprod")
    .complete();

 const tx = await hydraInstance.commitBlueprint();

  const signedTx = await myWallet.signTx(tx, true);
  const txhash = await myWallet.submitTx(signedTx);
  return txhash;
};

export { commit_ordinary };
