import { Verifier } from '@webb-tools/vbridge';
import { ethers } from 'ethers';

// Deploys an 8-sided VAnchor

export async function deployVAnchorVerifier() {
  const chainAProvider = new ethers.providers.WebSocketProvider('http://localhost:5001')
  const chainBProvider = new ethers.providers.WebSocketProvider('http://localhost:5002')
  const chainCProvider = new ethers.providers.WebSocketProvider('http://localhost:5003')
  const relayerPrivateKey =
  '0x0000000000000000000000000000000000000000000000000000000000000001';
  const chainAWallet = new ethers.Wallet(relayerPrivateKey, chainAProvider);
  const chainBWallet = new ethers.Wallet(relayerPrivateKey, chainBProvider);
  const chainCWallet = new ethers.Wallet(relayerPrivateKey, chainCProvider);

  for (let wallet of [chainAWallet, chainBWallet, chainCWallet]) {
    const verifier = await Verifier.createVerifier(wallet);
    console.log('deploying on: ', await wallet.getChainId())
    console.log('verifier address ', verifier.contract.address);
  }
}