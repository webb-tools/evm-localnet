require('dotenv').config();
import { fetchComponentsFromFilePaths, getChainIdType } from '@webb-tools/utils';
import { SignatureBridge, SignatureBridgeSide } from "@webb-tools/bridges";
import { ethers } from "ethers";
import { Anchor, AnchorHandler } from "@webb-tools/anchors";

import path from "path";
import { GovernedTokenWrapper } from '@webb-tools/tokens';

export async function attachNewAnchor() {
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

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/anchor/3/poseidon_anchor_3.wasm'),
    path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/anchor/3/witness_calculator.js'),
    path.resolve(__dirname, './protocol-solidity-fixtures/fixtures/anchor/3/circuit_final.zkey')
  );
  
  // Mapping of chainId to the desired webbWrapped token.
  const anchorTokens: Record<number, string> = {
    [chainIdTypeA]: '0x510C6297cC30A058F41eb4AF1BFC9953EaD8b577',
    [chainIdTypeB]: '0xcbD945E77ADB65651F503723aC322591f3435cC5',
    [chainIdTypeC]: '0x7758F98C1c487E5653795470eEab6C4698bE541b',
  };
  const bridgeSideAddresses: Record<number, string> = {
    [chainIdTypeA]: '0xDe09E74d4888Bc4e65F589e8c13Bce9F71DdF4c7',
    [chainIdTypeB]: '0x51a240271AB8AB9f9a21C82d9a85396b704E164d',
    [chainIdTypeC]: '0x2946259E0334f33A064106302415aD3391BeD384',
  };
  const anchorHashers: Record<number, string> = {
    [chainIdTypeA]: '0xA3183498b579bd228aa2B62101C40CC1da978F24',
    [chainIdTypeB]: '0x63f58053c9499E1104a6f6c6d2581d6D83067EEB',
    [chainIdTypeC]: '0x5CF7F96627F3C9903763d128A1cc5D97556A6b99',
  };
  const anchorHandlers: Record<number, string> = {
    [chainIdTypeA]: '0x51a240271AB8AB9f9a21C82d9a85396b704E164d',
    [chainIdTypeB]: '0xB9816fC57977D5A786E654c7CF76767be63b966e',
    [chainIdTypeC]: '0xDe09E74d4888Bc4e65F589e8c13Bce9F71DdF4c7',
  };
  const anchorVerifiers: Record<number, string> = {
    [chainIdTypeA]: '0xD24260C102B5D128cbEFA0F655E5be3c2370677C',
    [chainIdTypeB]: '0x7758F98C1c487E5653795470eEab6C4698bE541b',
    [chainIdTypeC]: '0xD30C8839c1145609E564b986F667b273Ddcb8496',
  };

  for (let chainIdTypeStr of Object.keys(anchorVerifiers)) {
    const chainIdType = Number(chainIdTypeStr);
    const governor = getWalletByChainIdType(chainIdType)

    const newAnchor = await Anchor.createAnchor(
      anchorVerifiers[chainIdType],
      anchorHashers[chainIdType],
      '10000000000000000',
      30,
      anchorTokens[chainIdType],
      anchorHandlers[chainIdType],
      2,
      zkComponents,
      governor,
    );

    const bridgeSide = await SignatureBridgeSide.connect(bridgeSideAddresses[chainIdType], governor, governor);
    const anchorHandler = await AnchorHandler.connect(anchorHandlers[chainIdType], governor);
    
    bridgeSide.setAnchorHandler(anchorHandler);

    await SignatureBridge.setPermissions(bridgeSide, [newAnchor]);

    const tokenInstance = await GovernedTokenWrapper.connect(anchorTokens[chainIdType], governor);

    // grant minting rights to the anchor
    await tokenInstance.grantMinterRole(newAnchor.getAddress()); 

    console.log(`new anchor: ${newAnchor.getAddress()} on chain ${chainIdType}`)
  }
}
