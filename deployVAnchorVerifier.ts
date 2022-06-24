import { Verifier } from '@webb-tools/vbridge';
import { ethers } from 'ethers';

// Deploys an 8-sided VAnchor

export async function deployVAnchorVerifier(
  deployers: Record<number, ethers.Wallet>,
) {
  const verifiers: Record<number, string> = {};

  for (let chainIdType of Object.keys(deployers)) {
    const verifier = await Verifier.createVerifier(deployers[chainIdType]);
    verifiers[chainIdType] = verifier.contract.address;
  }

  return verifiers;
}