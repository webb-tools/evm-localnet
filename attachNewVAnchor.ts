require('dotenv').config();
import { fetchComponentsFromFilePaths, ZkComponents } from '@webb-tools/utils';
import { SignatureBridgeSide } from "@webb-tools/bridges";
import { VBridge } from "@webb-tools/vbridge";
import { ethers } from "ethers";
import { VAnchor, AnchorHandler } from "@webb-tools/anchors";

import path from "path";
import { GovernedTokenWrapper, MintableToken } from '@webb-tools/tokens';

export async function attachNewVAnchor(
  tokens: Record<number, string>,
  bridgeSides: Record<number, string>,
  hashers: Record<number, string>,
  handlers: Record<number, string>,
  verifiers: Record<number, string>,
  wallets: Record<number, ethers.Wallet>
): Promise<Record<number, VAnchor>> {

  const isEightSided = Object.keys(wallets).length > 2;

  let zkComponentsSmall: ZkComponents;
  let zkComponentsLarge: ZkComponents;

  if (Object.keys(wallets).length > 2) {
    zkComponentsSmall = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_2/8/poseidon_vanchor_2_8.wasm'),
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_2/8/witness_calculator.js'),
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_2/8/circuit_final.zkey')
    );

    zkComponentsLarge = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_16/8/poseidon_vanchor_16_8.wasm'),
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_16/8/witness_calculator.js'),
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_16/8/circuit_final.zkey')
    );
  } else {
    zkComponentsSmall = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm'),
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_2/2/witness_calculator.js'),
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey')
    );

    zkComponentsLarge = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm'),
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_16/2/witness_calculator.js'),
      path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/vanchor_16/2/circuit_final.zkey')
    );
  }

  let anchors: Record<number, VAnchor> = {};

  for (let chainIdType of Object.keys(wallets)) {
    const governor = wallets[chainIdType];

    const newAnchor = await VAnchor.createVAnchor(
      verifiers[chainIdType],
      30,
      hashers[chainIdType],
      handlers[chainIdType],
      tokens[chainIdType],
      isEightSided ? 7 : 1,
      zkComponentsSmall,
      zkComponentsLarge,
      governor,
    );

    const bridgeSide = await SignatureBridgeSide.connect(bridgeSides[chainIdType], governor, governor);
    const anchorHandler = await AnchorHandler.connect(handlers[chainIdType], governor);

    console.log('anchorHandler from config', anchorHandler.contract.address);
    console.log('anchorHandler from VAnchor wrapper: ', await newAnchor.getHandler());

    bridgeSide.setAnchorHandler(anchorHandler);

    // Give update permissions to the anchorHandler address once the vanchor is initially configured.
    await VBridge.setPermissions(bridgeSide, [newAnchor]);

    const tokenInstance = GovernedTokenWrapper.connect(tokens[chainIdType], governor);

    // grant minting rights to the anchor
    await tokenInstance.grantMinterRole(newAnchor.getAddress()); 

    // Give permission for the anchor to move funds of the governor (evm-localnet CLI deposit)
    const mintableTokenInstance = await MintableToken.tokenFromAddress(tokens[chainIdType], governor)
    const tx = await mintableTokenInstance.approveSpending(newAnchor.contract.address);
    await tx.wait();
    
    anchors[chainIdType] = newAnchor;
  }

  return anchors;
}
