require('dotenv').config();
import { fetchComponentsFromFilePaths, getChainIdType, ZkComponents } from '@webb-tools/utils';
import { SignatureBridgeSide } from "@webb-tools/bridges";
import { VBridge } from "@webb-tools/vbridge";
import { ethers } from "ethers";
import { VAnchor, AnchorHandler } from "@webb-tools/anchors";

import path from "path";
import { GovernedTokenWrapper, MintableToken } from '@webb-tools/tokens';

export async function attachNewVAnchor(isEightSided: boolean): Promise<Record<number, VAnchor>> {
  const chainIdTypeA = getChainIdType(5001);
  const chainIdTypeB = getChainIdType(5002);
  const chainIdTypeC = getChainIdType(5003);

  const chainAProvider = new ethers.providers.WebSocketProvider('http://localhost:5001')
  const chainBProvider = new ethers.providers.WebSocketProvider('http://localhost:5002')
  const chainCProvider = new ethers.providers.WebSocketProvider('http://localhost:5003')
  const relayerPrivateKey =
  '0x0000000000000000000000000000000000000000000000000000000000000001';
  const chainAWallet = new ethers.Wallet(relayerPrivateKey, chainAProvider);
  const chainBWallet = new ethers.Wallet(relayerPrivateKey, chainBProvider);
  const chainCWallet = new ethers.Wallet(relayerPrivateKey, chainCProvider);

  const getWalletByChainIdType = (chainIdType: number): ethers.Wallet => {
    if (chainIdType == getChainIdType(5001)) {
      return chainAWallet;
    } else if (chainIdType == getChainIdType(5002)) {
      return chainBWallet;
    } else {
      return chainCWallet;
    }
  }
  let zkComponentsSmall: ZkComponents;
  let zkComponentsLarge: ZkComponents;

  if (isEightSided) {
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

  // Mapping of chainId to the desired webbWrapped token.
  let anchorTokens: Record<number, string> = {
    [chainIdTypeA]: '0x510C6297cC30A058F41eb4AF1BFC9953EaD8b577',
    [chainIdTypeB]: '0xcbD945E77ADB65651F503723aC322591f3435cC5',
    [chainIdTypeC]: '0x7758F98C1c487E5653795470eEab6C4698bE541b',
  };
  let bridgeSideAddresses: Record<number, string> = {
    [chainIdTypeA]: '0xDe09E74d4888Bc4e65F589e8c13Bce9F71DdF4c7',
    [chainIdTypeB]: '0x51a240271AB8AB9f9a21C82d9a85396b704E164d',
    [chainIdTypeC]: '0x2946259E0334f33A064106302415aD3391BeD384',
  };
  let anchorHashers: Record<number, string> = {
    [chainIdTypeA]: '0xA3183498b579bd228aa2B62101C40CC1da978F24',
    [chainIdTypeB]: '0x63f58053c9499E1104a6f6c6d2581d6D83067EEB',
    [chainIdTypeC]: '0x5CF7F96627F3C9903763d128A1cc5D97556A6b99',
  };
  let anchorHandlers: Record<number, string> = {
    [chainIdTypeA]: '0x51a240271AB8AB9f9a21C82d9a85396b704E164d',
    [chainIdTypeB]: '0xB9816fC57977D5A786E654c7CF76767be63b966e',
    [chainIdTypeC]: '0xDe09E74d4888Bc4e65F589e8c13Bce9F71DdF4c7',
  };
  let anchorVerifiers: Record<number, string> = {
    [chainIdTypeA]: '0x4ddcaefaD4Cd01f6dE911c33777100B1c530A85e',
    [chainIdTypeB]: '0xdB587ef6aaA16b5719CDd3AaB316F0E70473e9Be',
    [chainIdTypeC]: '0xe3a0c8943356982867FC2b93739BD0f70C4B3a70',
  };

  let anchors: Record<number, VAnchor> = {};

  for (let chainIdTypeStr of Object.keys(anchorVerifiers)) {
    const chainIdType = Number(chainIdTypeStr);
    const governor = getWalletByChainIdType(chainIdType)

    const newAnchor = await VAnchor.createVAnchor(
      anchorVerifiers[chainIdType],
      30,
      anchorHashers[chainIdType],
      anchorHandlers[chainIdType],
      anchorTokens[chainIdType],
      isEightSided ? 7 : 1,
      zkComponentsSmall,
      zkComponentsLarge,
      governor,
    );

    const bridgeSide = await SignatureBridgeSide.connect(bridgeSideAddresses[chainIdType], governor, governor);
    const anchorHandler = await AnchorHandler.connect(anchorHandlers[chainIdType], governor);

    console.log('anchorHandler from config', anchorHandler.contract.address);
    console.log('anchorHandler from VAnchor wrapper: ', await newAnchor.getHandler());

    bridgeSide.setAnchorHandler(anchorHandler);

    // Give update permissions to the anchorHandler address once the vanchor is initially configured.
    await VBridge.setPermissions(bridgeSide, [newAnchor]);

    const tokenInstance = GovernedTokenWrapper.connect(anchorTokens[chainIdType], governor);

    // grant minting rights to the anchor
    await tokenInstance.grantMinterRole(newAnchor.getAddress()); 

    // Give permission for the anchor to move funds of the governor (evm-localnet CLI deposit)
    const mintableTokenInstance = await MintableToken.tokenFromAddress(anchorTokens[chainIdType], governor)
    const tx = await mintableTokenInstance.approveSpending(newAnchor.contract.address);
    await tx.wait();
    
    anchors[chainIdType] = newAnchor;
  }

  return anchors;
}
