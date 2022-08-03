import { ethers } from 'ethers';
import { ECPair } from 'ecpair';

export function ethAddressFromUncompressedPublicKey(
  publicKey: `0x${string}`
): `0x${string}` {
  const pubKeyHash = ethers.utils.keccak256(publicKey); // we hash it.
  const address = ethers.utils.getAddress(`0x${pubKeyHash.slice(-40)}`); // take the last 20 bytes and convert it to an address.
  return address as `0x${string}`;
}

/**
 * Encode function Signature in the Solidity format.
 */
export function encodeFunctionSignature(func: string): `0x${string}` {
  return ethers.utils
    .keccak256(ethers.utils.toUtf8Bytes(func))
    .slice(0, 10) as `0x${string}`;
}

export function uncompressPublicKey(compressed: string): `0x${string}` {
  const dkgPubKey = ECPair.fromPublicKey(Buffer.from(compressed.slice(2), 'hex'), {
    compressed: false,
  }).publicKey.toString('hex');
  // now we remove the `04` prefix byte and return it.
  return `0x${dkgPubKey.slice(2)}` as `0x${string}`;
}
