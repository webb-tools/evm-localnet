// This a simple script to start two local testnet chains and deploy the contracts on both of them
require('dotenv').config();
import readline from 'readline';
import { ethers } from 'ethers';
import { GovernedTokenWrapper, MintableToken } from '@webb-tools/tokens';
import { getChainIdType } from '@webb-tools/utils';
import { fundAccounts } from './fundAccounts';
import { calculateTypedChainId, CircomUtxo } from '@webb-tools/sdk-core';
import { LocalEvmChain } from '@webb-tools/test-utils';
import { getZkComponents } from './getZkComponents';
import { ethAddressFromUncompressedPublicKey, uncompressPublicKey } from './ethHelperFunctions';

export type GanacheAccounts = {
  balance: string;
  secretKey: string;
};

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
  const chainAWallet = new ethers.Wallet(relayerPrivateKey, chainA.provider());
  const chainBWallet = new ethers.Wallet(relayerPrivateKey, chainB.provider());
  const chainCWallet = new ethers.Wallet(relayerPrivateKey, chainC.provider());

  // do a random transfer on chainA to a random address
  // do it on chainB twice.
  // so we do have different nonce for that account.
  let tx = await chainAWallet.sendTransaction({
    to: '0x0000000000000000000000000000000000000000',
    value: ethers.utils.parseEther('0.001'),
  });
  await tx.wait();
  tx = await chainBWallet.sendTransaction({
    to: '0x0000000000000000000000000000000000000000',
    value: ethers.utils.parseEther('0.001'),
  });
  await tx.wait();
  tx = await chainBWallet.sendTransaction({
    to: '0x0000000000000000000000000000000000000000',
    value: ethers.utils.parseEther('0.001'),
  });
  await tx.wait();
  // Deploy the token on chainA
  const chainAToken = await chainA.deployToken('ChainA', 'webbA', chainAWallet);
  // Deploy the token on chainB
  const chainBToken = await chainB.deployToken('ChainB', 'webbB', chainBWallet);
  // Deploy the token on chainC
  const chainCToken = await chainC.deployToken('ChainC', 'webbC', chainCWallet);

  // get the fixtures for an eight sided deployment:
  const { smallFixtures, largeFixtures } = await getZkComponents(3);

  // Deploy the signature bridge.
  const signatureBridge = await LocalEvmChain.deployVBridge(
    [chainA, chainB, chainC],
    [chainAToken, chainBToken, chainCToken],
    [chainAWallet, chainBWallet, chainCWallet],
    smallFixtures,
    largeFixtures
  );

  // get chainA bridge
  const chainASignatureBridge = signatureBridge.getVBridgeSide(chainA.typedChainId)!;
  // get chainB bridge
  const chainBSignatureBridge = signatureBridge.getVBridgeSide(chainB.typedChainId)!;
  console.log('sigBridgeB address: ', chainBSignatureBridge.contract.address);
  // get chainC bridge
  const chainCSignatureBridge = signatureBridge.getVBridgeSide(chainC.typedChainId)!;

  // get the anchor on chainA
  const chainASignatureAnchor = signatureBridge.getVAnchor(
    chainA.typedChainId,
  )!;
  await chainASignatureAnchor.setSigner(chainAWallet);

  const chainAHandler = await chainASignatureAnchor.getHandler();
  console.log('Chain A Handler address: ', chainAHandler)

  // get the anchor on chainB
  const chainBSignatureAnchor = signatureBridge.getVAnchor(
    chainB.typedChainId,
  )!;
  await chainBSignatureAnchor.setSigner(chainBWallet);

  const chainBHandler = await chainBSignatureAnchor.getHandler();
  console.log('Chain B Handler address: ', chainBHandler)
  
  // get the anchor on chainC
  const chainCSignatureAnchor = signatureBridge.getVAnchor(
    chainC.typedChainId,
  )!;
  await chainCSignatureAnchor.setSigner(chainCWallet);

  const chainCHandler = await chainCSignatureAnchor.getHandler();
  console.log('Chain C Handler address: ', chainCHandler)

  // approve token spending
  const webbASignatureTokenAddress = signatureBridge.getWebbTokenAddress(
    chainA.typedChainId
  )!;

  const webbASignatureToken = await MintableToken.tokenFromAddress(
    webbASignatureTokenAddress,
    chainAWallet
  );
  tx = await webbASignatureToken.approveSpending(
    chainASignatureAnchor.contract.address
  );
  await tx.wait();
  await webbASignatureToken.mintTokens(
    chainAWallet.address,
    ethers.utils.parseEther('1000')
  );

  const webbBSignatureTokenAddress = signatureBridge.getWebbTokenAddress(chainB.typedChainId)!;
  console.log('webbBTokenAddress: ', webbBSignatureTokenAddress);

  const webbBSignatureToken = await MintableToken.tokenFromAddress(
    webbBSignatureTokenAddress,
    chainBWallet
  );
  tx = await webbBSignatureToken.approveSpending(chainBSignatureAnchor.contract.address);
  await tx.wait();
  await webbBSignatureToken.mintTokens(
    chainBWallet.address,
    ethers.utils.parseEther('1000')
  );

  const webbCSignatureTokenAddress = signatureBridge.getWebbTokenAddress(chainC.typedChainId)!;

  const webbCSignatureToken = await MintableToken.tokenFromAddress(
    webbCSignatureTokenAddress,
    chainCWallet
  );
  tx = await webbCSignatureToken.approveSpending(chainCSignatureAnchor.contract.address);
  await tx.wait();
  await webbCSignatureToken.mintTokens(
    chainCWallet.address,
    ethers.utils.parseEther('1000')
  );

  // stop the server on Ctrl+C or SIGINT singal
  process.on('SIGINT', () => {
    chainA.stop();
    chainB.stop();
    chainC.stop();
  });

  // mint wrappable and governed tokens to pre-funded accounts
  await fundAccounts(
    {
      [chainA.typedChainId]: chainAToken,
      [chainB.typedChainId]: chainBToken,
      [chainC.typedChainId]: chainCToken,
    },
    {
      [chainA.typedChainId]: webbASignatureToken,
      [chainB.typedChainId]: webbBSignatureToken,
      [chainC.typedChainId]: webbCSignatureToken,
    },
    [
      '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf',
      '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF',
      '0xd644f5331a6F26A7943CEEbB772e505cDDd21700'
    ]
  );

  printAvailableCommands();

  // setup readline
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on('line', async (cmdRaw) => {
    const cmd = cmdRaw.trim();

    if (cmd.startsWith('deposit')) {
      const utxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: getChainIdType(5002).toString(),
        originChainId: getChainIdType(5001).toString(),
        amount: '10000000000',
      })

      await signatureBridge.transact(
        [],
        [utxo],
        '0',
        '0',
        '0',
        '0',
        chainAWallet
      );

      console.log('Utxo: ', utxo.serialize());
      return;
    }

    if (cmd.startsWith('withdraw')) {
      // The serialized utxo is the next arg
      const utxoString = cmd.split(' ')[1];

      const utxo = await CircomUtxo.deserialize(utxoString);
      utxo.setOriginChainId(getChainIdType(5001).toString());
      signatureBridge.getVBridgeSide(chainB.evmId);

      await signatureBridge.transact(
        [utxo],
        [],
        0,
        0,
        '0x0000000000000000000000000000000000000001',
        '0',
        chainBWallet
      );

      console.log('transact worked without crashing');
      return;
    }

    if (cmd.startsWith('transfer ownership to governor')) {
      const compressedKey = cmd.split('"')[1];
      const uncompressedKey = uncompressPublicKey(compressedKey);
      const governorAddress = ethAddressFromUncompressedPublicKey(uncompressedKey);

      let tx = await chainASignatureBridge.transferOwnership(governorAddress, 0);
      await tx.wait();
      tx = await chainBSignatureBridge.transferOwnership(governorAddress, 0);
      await tx.wait();
      tx = await chainCSignatureBridge.transferOwnership(governorAddress, 0);
      await tx.wait();
      console.log('ownership transferred!')
      return;
    }

    if (cmd.startsWith('add wrappable token to a')) {
      const governedToken = await GovernedTokenWrapper.connect(webbASignatureTokenAddress, chainAWallet);
      const newWrappableToken = await MintableToken.createToken('localETH', 'localETH', chainAWallet);
      // address of private key
      await newWrappableToken.mintTokens('0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF', '100000000000000000000');
      await chainASignatureBridge.executeAddTokenProposalWithSig(governedToken, newWrappableToken.contract.address);
      console.log('wrappable token added to hermes');
      return;
    }

    if (cmd.startsWith('mint wrappable token on a')) {
      const address = cmd.split('"')[1];
      await chainAToken.mintTokens(address, '100000000000000000000');
      console.log('minted tokens');
      return;
    }

    if (cmd.startsWith('mint wrappable token on b')) {
      const address = cmd.split('"')[1];
      await chainBToken.mintTokens(address, '100000000000000000000');
      console.log('minted tokens');
      return;
    }

    if (cmd.startsWith('mint governed token on a')) {
      const address = cmd.split('"')[1];
      await webbASignatureToken.mintTokens(address, '100000000000000000000');
      console.log('minted tokens');
      return;
    }

    if (cmd.startsWith('mint governed token on b')) {
      const address = cmd.split('"')[1];
      await webbBSignatureToken.mintTokens(address, '100000000000000000000');
      console.log('minted tokens');
      return;
    }

    if (cmd.startsWith('print config')) {
      console.log(
        'ChainA signature bridge (Hermes): ',
        chainASignatureBridge.contract.address
      );
      const chainAHandler = await chainASignatureAnchor.getHandler();
      console.log('Chain A Handler address: ', chainAHandler)
      console.log(
        'ChainA variable anchor (Hermes): ',
        chainASignatureAnchor.contract.address
      );
      console.log('ChainAToken: ', chainAToken.contract.address);
      console.log('ChainA Webb token (Hermes): ', webbASignatureToken.contract.address);
      console.log(' --- --- --- --- --- --- --- --- --- --- --- --- ---');
      console.log(
        'ChainB signature bridge (Athena): ',
        chainBSignatureBridge.contract.address
      );
      const chainBHandler = await chainBSignatureAnchor.getHandler();
      console.log('Chain B Handler address: ', chainBHandler)
      console.log(
        'ChainB variable anchor (Athena): ',
        chainBSignatureAnchor.contract.address
      );
      console.log('ChainBToken: ', chainBToken.contract.address);
      console.log('ChainB token Webb (Athena): ', webbBSignatureToken.contract.address);
      console.log(' --- --- --- --- --- --- --- --- --- --- --- --- ---');
      console.log(
        'ChainC signature bridge (Demeter): ',
        chainCSignatureBridge.contract.address
      );
      const chainCHandler = await chainCSignatureAnchor.getHandler();
      console.log('Chain C Handler address: ', chainCHandler)
      console.log(
        'ChainC variable anchor (Demeter): ',
        chainCSignatureAnchor.contract.address
      );
      console.log('ChainCToken: ', chainCToken.contract.address);
      console.log('ChainC token Webb (Demeter): ', webbCSignatureToken.contract.address);

      console.log('\n');
      return;
    }

    if (cmd.startsWith('print root on chain a')) {
      console.log('Root on chain A (signature), please wait...');
      const root2 = await chainASignatureAnchor.contract.getLastRoot();
      const latestNeighborRoots2 =
        await chainASignatureAnchor.contract.getLatestNeighborRoots();
      console.log('Root on chain A (signature): ', root2);
      console.log(
        'Latest neighbor roots on chain A (signature): ',
        latestNeighborRoots2
      );
      return;
    }

    if (cmd.startsWith('print root on chain b')) {
      console.log('Root on chain B (signature), please wait...');
      const root2 = await chainBSignatureAnchor.contract.getLastRoot();
      const latestNeighborRoots2 =
        await chainBSignatureAnchor.contract.getLatestNeighborRoots();
      console.log('Root on chain B (signature): ', root2);
      console.log(
        'Latest neighbor roots on chain B (signature): ',
        latestNeighborRoots2
      );
      return;
    }

    if (cmd.startsWith('print governor on chain a')) {
      const governor = chainASignatureBridge.governor;
      console.log('governor in chainASigBridge class is: ', (governor as ethers.Wallet).address);
      const walletAddress = await chainASignatureBridge.contract.governor();
      console.log('governor in contract is: ', walletAddress);
      return;
    }

    if (cmd.startsWith('print governor on chain b')) {
      const governor = chainBSignatureBridge.governor;
      console.log('governor in chainASigBridge class is: ', (governor as ethers.Wallet).address);
      const walletAddress = await chainBSignatureBridge.contract.governor();
      console.log('governor in contract is: ', walletAddress);
      return;
    }

    if (cmd === 'exit') {
      // shutdown the servers
      await chainA.stop();
      await chainB.stop();
      await chainC.stop();
      rl.close();
      return;
    }

    console.log('Unknown command: ', cmd);
    printAvailableCommands();
  });
}

function printAvailableCommands() {
  console.log('Available commands:');
  console.log('  deposit');
  console.log('  withdraw <utxo string>')
  console.log('  transfer ownership to governor "<compressed dkg key>"');
  console.log('  add wrappable token to a');
  console.log('  mint wrappable token on a to "<address>"')
  console.log('  mint wrappable token on b to "<address>"')
  console.log('  mint governed token on a to "<address>"')
  console.log('  mint governed token on b to "<address>"')
  console.log('  print config');
  console.log('  print root on chain a');
  console.log('  print root on chain b');
  console.log('  print governor on chain a');
  console.log('  exit');
}

main().catch(console.error);
