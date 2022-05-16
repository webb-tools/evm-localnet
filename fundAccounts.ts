require('dotenv').config();
import { ethers } from "ethers";
import { MintableToken } from '@webb-tools/tokens';

// This function mints tokens of the wrappable and governed tokens on the network
//  wrappableTokens: mapping from chainIdType to admin configured signer instance of MintableToken
//  governedTokens: mapping from chainIdType to admin configured signer instance of MintableToken
//  addresses: the list of addresses to fund
export async function fundAccounts(
  wrappableTokens: Record<number, MintableToken>,
  governedTokens: Record<number, MintableToken>,
  addresses: string[]
) {

  // For each of the chainIdTypes, mint the wrappable and governed tokens to all of the addresses
  const chainIdTypes = Object.keys(governedTokens);

  for (const chainIdType of chainIdTypes) {
    for (const address of addresses) {
      await wrappableTokens[chainIdType].mintTokens(address, ethers.utils.parseEther('1000'));
      await governedTokens[chainIdType].mintTokens(address, ethers.utils.parseEther('1000'));
    }
  }
}
