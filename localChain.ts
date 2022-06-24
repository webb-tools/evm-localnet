import { SignatureBridge } from '@webb-tools/bridges';
import { MintableToken } from "@webb-tools/tokens";
import { getChainIdType, fetchComponentsFromFilePaths } from "@webb-tools/utils";
import { startGanacheServer } from '@webb-tools/test-utils';
import { ethers } from "ethers";
import { Server } from "ganache";
import path from "path";
import { GanacheAccounts } from "./localnet";

// Let's first define a localchain
export class LocalChain {
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
