import { Anchor } from '@webb-tools/anchors';
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';
import { ethers } from 'ethers';
import path from 'path';

const relayerPrivateKey =
    '0x0000000000000000000000000000000000000000000000000000000000000001';

const chainAProvider = new ethers.providers.WebSocketProvider('http://localhost:5001')
const chainBProvider = new ethers.providers.WebSocketProvider('http://localhost:5002')
const chainCProvider = new ethers.providers.WebSocketProvider('http://localhost:5003')

const chainAWallet = new ethers.Wallet(relayerPrivateKey, chainAProvider);
const chainBWallet = new ethers.Wallet(relayerPrivateKey, chainBProvider);
const chainCWallet = new ethers.Wallet(relayerPrivateKey, chainCProvider);

async function viewAnchorHandler(anchor: Anchor, passedWallet: ethers.Signer) {
  const anchorHandler = await anchor.contract.handler();
  console.log(anchorHandler);
  return anchorHandler;
}

async function viewAnchorHasher(anchor: Anchor, passedWallet: ethers.Signer) {
  const anchorHasher = await anchor.contract.hasher();
  console.log(anchorHasher);
  return anchorHasher;
}

async function viewAnchorVerifier(anchor: Anchor, passedWallet: ethers.Signer) {
  const anchorVerifier = await anchor.contract.verifier();
  console.log(anchorVerifier);
  return anchorVerifier;
}

async function run() {

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(
      __dirname,
      `./protocol-solidity-fixtures/fixtures/anchor/3/poseidon_anchor_3.wasm`
    ),
    path.resolve(
      __dirname,
      `./protocol-solidity-fixtures/fixtures/anchor/3/witness_calculator.js`
    ),
    path.resolve(
      __dirname,
      `./protocol-solidity-fixtures/fixtures/anchor/3/circuit_final.zkey`
    )
  );

  const anchorA = await Anchor.connect('0xbfce6B877Ebff977bB6e80B24FbBb7bC4eBcA4df', zkComponents, chainAWallet);
  const anchorB = await Anchor.connect('0xcd75Ad7AC9C9325105f798c476E84176648F391A', zkComponents, chainBWallet);
  const anchorC = await Anchor.connect('0x4e3df2073bf4b43B9944b8e5A463b1E185D6448C', zkComponents, chainCWallet);

  await viewAnchorVerifier(anchorA, chainAWallet);
  await viewAnchorVerifier(anchorB, chainBWallet);
  await viewAnchorVerifier(anchorC, chainCWallet);

  return;
}

run().then(() => process.exit);
