import { ethers } from "ethers";
import { getZkComponents } from "./getZkComponents";
import { LocalEvmChain } from "@webb-tools/test-utils";

async function main() {
  const relayerPrivateKey =
    '0x0000000000000000000000000000000000000000000000000000000000000001';
  const senderPrivateKey =
    '0x0000000000000000000000000000000000000000000000000000000000000002';

  const chainA = await LocalEvmChain.init('Hermes', 5001, [
    {
      balance: ethers.utils.parseEther('1000').toHexString(),
      secretKey: relayerPrivateKey,
    },
    {
      balance: ethers.utils.parseEther('1000').toHexString(),
      secretKey: senderPrivateKey,
    },
    {
      balance: ethers.utils.parseEther('1000').toHexString(),
      secretKey: '0xc0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
    },
  ],
  {
    quiet: false
  });
  const chainB = await LocalEvmChain.init('Athena', 5002, [
    {
      balance: ethers.utils.parseEther('1000').toHexString(),
      secretKey: relayerPrivateKey,
    },
    {
      balance: ethers.utils.parseEther('1000').toHexString(),
      secretKey: senderPrivateKey,
    },
    {
      balance: ethers.utils.parseEther('1000').toHexString(),
      secretKey: '0xc0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
    },
  ],
  {
    quiet: false
  });
  const chainC = await LocalEvmChain.init('Demeter', 5003, [
    {
      balance: ethers.utils.parseEther('1000').toHexString(),
      secretKey: relayerPrivateKey,
    },
    {
      balance: ethers.utils.parseEther('1000').toHexString(),
      secretKey: senderPrivateKey,
    },
    {
      balance: ethers.utils.parseEther('1000').toHexString(),
      secretKey: '0xc0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
    },
  ],
  {
    quiet: false
  });
}

main().catch(console.error);