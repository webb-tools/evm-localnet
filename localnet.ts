// This a simple script to start two local testnet chains and deploy the contracts on both of them
require('dotenv').config();
import readline from 'readline';
import { ethers } from 'ethers';
import { SignatureBridge } from '@webb-tools/bridges';
import { GovernedTokenWrapper, MintableToken } from '@webb-tools/tokens';
import { fetchComponentsFromFilePaths, getChainIdType } from '@webb-tools/utils';
import path from 'path';
import { IAnchorDeposit, IUTXOInput } from '@webb-tools/interfaces';
import { Anchor, VAnchor } from '@webb-tools/anchors';
import { Server } from 'ganache';
import { attachNewAnchor } from './attachNewAnchor';
import { attachNewVAnchor } from './attachNewVAnchor';
import { fundAccounts } from './fundAccounts';
import { deployVAnchorVerifier } from './deployVAnchorVerifier';
import { startGanacheServer } from '@webb-tools/test-utils';
import { CircomUtxo } from '@webb-tools/sdk-core';

export type GanacheAccounts = {
  balance: string;
  secretKey: string;
};

// Let's first define a localchain
class LocalChain {
  constructor(
    public readonly endpoint: string,
    public readonly chainId: number,
    private readonly server: Server<"ethereum">,
  ) {
  }

  public static async init(
    name: string,
    evmId: number,
    initalBalances: GanacheAccounts[]
  ): Promise<LocalChain> {
    const endpoint = `http://localhost:${evmId}`;
    const chainId = getChainIdType(evmId);
    const server = await startGanacheServer(evmId, evmId, initalBalances, {
      quiet: false,
      miner: {
        blockTime: 1,
      },
    });
    const chain = new LocalChain(endpoint, chainId, server);
    return chain;
  }

  public provider(): ethers.providers.WebSocketProvider {
    return new ethers.providers.WebSocketProvider(this.endpoint);
  }

  public web3Provider(): ethers.providers.Web3Provider {
    return new ethers.providers.Web3Provider(this.server.provider);
  }

  public async stop() {
    this.server.close();
  }

  public async deployToken(
    name: string,
    symbol: string,
    wallet: ethers.Signer
  ): Promise<MintableToken> {
    return MintableToken.createToken(name, symbol, wallet);
  }

  // It is expected that parameters are passed with the same indices of arrays.
  public static async deploySignatureBridge(
    chains: LocalChain[],
    tokens: MintableToken[],
    wallets: ethers.Wallet[]
  ): Promise<SignatureBridge> {
    let assetRecord: Record<number, string[]> = {};
    let deployers: Record<number, ethers.Wallet> = {};
    let chainIdsArray: number[] = [];

    for (let i=0; i<chains.length; i++) {
      wallets[i].connect(chains[i].provider());
      assetRecord[chains[i].chainId] = [tokens[i].contract.address];
      deployers[chains[i].chainId] = wallets[i];
      chainIdsArray.push(chains[i].chainId);
    }

    const bridgeInput = {
      anchorInputs: {
        asset: assetRecord,
        anchorSizes: [ethers.utils.parseEther('1')],
      },
      chainIDs: chainIdsArray,
    }
    const deployerConfig = { 
      ...deployers
    }
    const governorConfig = {
      ...deployers
    }

    console.log('bridgeInput: ', bridgeInput);
    console.log('deployerConfig: ', deployerConfig);
    console.log('governorConfig: ', deployerConfig);

    const zkComponents = await fetchComponentsFromFilePaths(
      path.resolve(
        __dirname,
        `./protocol-solidity-fixtures/fixtures/anchor/${chains.length}/poseidon_anchor_${chains.length}.wasm`
      ),
      path.resolve(
        __dirname,
        `./protocol-solidity-fixtures/fixtures/anchor/${chains.length}/witness_calculator.js`
      ),
      path.resolve(
        __dirname,
        `./protocol-solidity-fixtures/fixtures/anchor/${chains.length}/circuit_final.zkey`
      )
    );

    return SignatureBridge.deployFixedDepositBridge(
      bridgeInput,
      deployerConfig,
      governorConfig,
      zkComponents
    );
  }
}

async function main() {
  const relayerPrivateKey =
    '0x0000000000000000000000000000000000000000000000000000000000000001';
  const senderPrivateKey =
    '0x0000000000000000000000000000000000000000000000000000000000000002';

  const chainA = await LocalChain.init('Hermes', 5001, [
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
  ]);
  const chainB = await LocalChain.init('Athena', 5002, [
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
  ]);
  const chainC = await LocalChain.init('Demeter', 5003, [
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
  ]);
  const chainAWallet = new ethers.Wallet(relayerPrivateKey, chainA.provider());
  const chainBWallet = new ethers.Wallet(relayerPrivateKey, chainB.provider());
  const chainCWallet = new ethers.Wallet(relayerPrivateKey, chainC.provider());

  let chainADeposits: IAnchorDeposit[] = [];
  let chainBDeposits: IAnchorDeposit[] = [];
  let chainCDeposits: IAnchorDeposit[] = [];

  let vanchorAUTXOs: IUTXOInput[] = [];
  let vanchorBUTXOs: IUTXOInput[] = [];
  let vanchorCUTXOs: IUTXOInput[] = [];

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

  // Deploy the signature bridge.
  const signatureBridge = await LocalChain.deploySignatureBridge(
    [chainA, chainB, chainC],
    [chainAToken, chainBToken, chainCToken],
    [chainAWallet, chainBWallet, chainCWallet]
  );

  // get chainA bridge
  const chainASignatureBridge = signatureBridge.getBridgeSide(chainA.chainId)!;
  // get chainB bridge
  const chainBSignatureBridge = signatureBridge.getBridgeSide(chainB.chainId)!;
  console.log('sigBridgeB address: ', chainBSignatureBridge.contract.address);
  // get chainC bridge
  const chainCSignatureBridge = signatureBridge.getBridgeSide(chainC.chainId)!;

  // get the anchor on chainA
  const chainASignatureAnchor = signatureBridge.getAnchor(
    chainA.chainId,
    ethers.utils.parseEther('1')
  )!;
  await chainASignatureAnchor.setSigner(chainAWallet);

  const chainAHandler = await chainASignatureAnchor.getHandler();
  console.log('Chain A Handler address: ', chainAHandler)

  // get the anchor on chainB
  const chainBSignatureAnchor = signatureBridge.getAnchor(
    chainB.chainId,
    ethers.utils.parseEther('1')
  )!;
  await chainBSignatureAnchor.setSigner(chainBWallet);

  const chainBHandler = await chainBSignatureAnchor.getHandler();
  console.log('Chain B Handler address: ', chainBHandler)
  
  // get the anchor on chainC
  const chainCSignatureAnchor = signatureBridge.getAnchor(
    chainC.chainId,
    ethers.utils.parseEther('1')
  )!;
  await chainCSignatureAnchor.setSigner(chainCWallet);

  const chainCHandler = await chainCSignatureAnchor.getHandler();
  console.log('Chain C Handler address: ', chainCHandler)

  // approve token spending
  const webbASignatureTokenAddress = signatureBridge.getWebbTokenAddress(
    chainA.chainId
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

  const webbBSignatureTokenAddress = signatureBridge.getWebbTokenAddress(chainB.chainId)!;
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

  const webbCSignatureTokenAddress = signatureBridge.getWebbTokenAddress(chainC.chainId)!;

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

  // Setup another anchor deployment, which attaches to the existing bridge / handler / hasher / verifier / token
  await attachNewAnchor();

  // Do a VAnchor Deployment
  await deployVAnchorVerifier();
  const vanchors = await attachNewVAnchor(true);

  // Give token permissions to the newly created VAnchor:
  // await webbASignatureToken.approveSpending('0xb824C5F99339C7E486a1b452B635886BE82bc8b7');
  // await webbBSignatureToken.approveSpending('0xFEe587E68c470DAE8147B46bB39fF230A29D4769');

  // mint wrappable and governed tokens to pre-funded accounts
  await fundAccounts(
    {
      [chainA.chainId]: chainAToken,
      [chainB.chainId]: chainBToken,
      [chainC.chainId]: chainCToken,
    },
    {
      [chainA.chainId]: webbASignatureToken,
      [chainB.chainId]: webbBSignatureToken,
      [chainC.chainId]: webbCSignatureToken,
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

    // check if cmd is deposit chainA
    if (cmd.startsWith('fixed deposit on chain a')) {
      console.log('Depositing Chain A, please wait...');
      const deposit2 = await chainASignatureAnchor.deposit(chainB.chainId);
      chainADeposits.push(deposit2);
      console.log('Deposit on chain A (signature): ', deposit2);
      // await signatureBridge.updateLinkedAnchors(chainASignatureAnchor);
      return;
    }

    if (cmd.startsWith('fixed deposit on chain b')) {
      console.log('Depositing Chain B, please wait...');
      const deposit2 = await chainBSignatureAnchor.deposit(chainA.chainId);
      chainBDeposits.push(deposit2);
      console.log('Deposit on chain B (signature): ', deposit2);
      // await signatureBridge.updateLinkedAnchors(chainASignatureAnchor);
      return;
    }

    if (cmd.startsWith('variable deposit on chain a')) {
      const utxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: getChainIdType(5002).toString(),
        originChainId: getChainIdType(5001).toString(),
        amount: '10000000000',
      })

      await vanchors[chainA.chainId].transact(
        [],
        [utxo],
        {},
        '0',
        '0',
        '0'
      );
    }

    if (cmd.startsWith('relay from a to b')) {
      await chainASignatureAnchor.update();
      console.log('updated');
      await signatureBridge.updateLinkedAnchors(chainASignatureAnchor);
    }

    if (cmd.startsWith('relay from b to a')) {
      await (chainBSignatureAnchor as unknown as Anchor).update(chainBSignatureAnchor.latestSyncedBlock);
      await signatureBridge.updateLinkedAnchors(chainBSignatureAnchor);
    }

    if (cmd.startsWith('mint wrappable token on a')) {
      const address = cmd.split('"')[1];
      await chainAToken.mintTokens(address, '100000000000000000000');
    }

    if (cmd.startsWith('mint wrappable token on b')) {
      const address = cmd.split('"')[1];
      await chainBToken.mintTokens(address, '100000000000000000000');
    }

    if (cmd.startsWith('mint governed token on a')) {
      const address = cmd.split('"')[1];
      await webbASignatureToken.mintTokens(address, '100000000000000000000');
    }

    if (cmd.startsWith('mint governed token on b')) {
      const address = cmd.split('"')[1];
      await webbBSignatureToken.mintTokens(address, '100000000000000000000');
    }

    if (cmd.startsWith('print config')) {
      console.log(
        'ChainA signature bridge (Hermes): ',
        chainASignatureBridge.contract.address
      );
      const chainAHandler = await chainASignatureAnchor.getHandler();
      console.log('Chain A Handler address: ', chainAHandler)
      console.log(
        'ChainA fixed anchor (Hermes): ',
        chainASignatureAnchor.contract.address
      );
      console.log(
        'ChainA variable anchor: ',
        vanchors[chainA.chainId].contract.address
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
        'ChainB fixed anchor (Athena): ',
        chainBSignatureAnchor.contract.address
      );
      console.log(
        'ChainB variable anchor: ',
        vanchors[chainB.chainId].contract.address
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
        'ChainC fixed anchor (Demeter): ',
        chainCSignatureAnchor.contract.address
      );
      console.log(
        'ChainC variable anchor: ',
        vanchors[chainC.chainId].contract.address
      );
      console.log('ChainCToken: ', chainCToken.contract.address);
      console.log('ChainC token Webb (Demeter): ', webbCSignatureToken.contract.address);

      console.log('\n');
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
      console.log('governor in chainASigBridge class is: ', governor.address);
      const walletAddress = await chainASignatureBridge.contract.governor();
      console.log('governor in contract is: ', walletAddress);
    }

    if (cmd.startsWith('print governor on chain b')) {
      const governor = chainBSignatureBridge.governor;
      console.log('governor in chainASigBridge class is: ', governor.address);
      const walletAddress = await chainBSignatureBridge.contract.governor();
      console.log('governor in contract is: ', walletAddress);
    }

    if (cmd === 'exit') {
      // shutdown the servers
      await chainA.stop();
      await chainB.stop();
      rl.close();
      return;
    }

    console.log('Unknown command: ', cmd);
    printAvailableCommands();
  });
}

function printAvailableCommands() {
  console.log('Available commands:');
  console.log('  fixed deposit on chain a');
  console.log('  fixed deposit on chain b');
  console.log('  variable deposit on chain a');
  console.log('  variable deposit on chain b');
  console.log('  mint wrappable token on a to "<address>"')
  console.log('  mint wrappable token on b to "<address>"')
  console.log('  mint governed token on a to "<address>"')
  console.log('  mint governed token on b to "<address>"')
  console.log('  print config');
  console.log('  print root on chain a');
  console.log('  print root on chain b');
  console.log('  print governor on chain a');
  console.log('  print governor on chain b');
  console.log('  exit');
}

main().catch(console.error);
