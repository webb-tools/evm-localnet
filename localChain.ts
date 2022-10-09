import { OpenVBridge, VBridge, VBridgeInput } from '@webb-tools/vbridge';
import { MintableToken } from "@webb-tools/tokens";
import { getChainIdType, fetchComponentsFromFilePaths, ZkComponents } from "@webb-tools/utils";
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
      quiet: true,
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
  public static async deployVBridge(
    chains: LocalChain[],
    tokens: MintableToken[],
    wallets: ethers.Wallet[]
  ): Promise<VBridge> {
    let assetRecord: Record<number, string[]> = {};
    let deployers: Record<number, ethers.Wallet> = {};
    let governors: Record<number, string> = {};
    let chainIdsArray: number[] = [];

    for (let i=0; i<chains.length; i++) {
      wallets[i].connect(chains[i].provider());
      assetRecord[chains[i].chainId] = [tokens[i].contract.address];
      deployers[chains[i].chainId] = wallets[i];
      governors[chains[i].chainId] = await wallets[i].getAddress();
      chainIdsArray.push(chains[i].chainId);
    }

    const bridgeInput: VBridgeInput = {
      vAnchorInputs: {
        asset: assetRecord,
      },
      chainIDs: chainIdsArray,
      webbTokens: new Map()
    }
    const deployerConfig = { 
      ...deployers
    }
    const governorConfig = {
      ...governors
    }

    const isEightSided = Object.keys(chains).length > 2;

    let zkComponentsSmall: ZkComponents;
    let zkComponentsLarge: ZkComponents;
  
    if (isEightSided) {
      zkComponentsSmall = await fetchComponentsFromFilePaths(
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_2/8/poseidon_vanchor_2_8.wasm'),
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_2/8/witness_calculator.js'),
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_2/8/circuit_final.zkey')
      );
  
      zkComponentsLarge = await fetchComponentsFromFilePaths(
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_16/8/poseidon_vanchor_16_8.wasm'),
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_16/8/witness_calculator.js'),
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_16/8/circuit_final.zkey')
      );
    } else {
      zkComponentsSmall = await fetchComponentsFromFilePaths(
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm'),
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_2/2/witness_calculator.js'),
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_2/2/circuit_final.zkey')
      );
  
      zkComponentsLarge = await fetchComponentsFromFilePaths(
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm'),
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_16/2/witness_calculator.js'),
        path.resolve(__dirname, './solidity-fixtures/solidity-fixtures/vanchor_16/2/circuit_final.zkey')
      );
    }

    return VBridge.deployVariableAnchorBridge(
      bridgeInput,
      deployerConfig,
      governorConfig,
      zkComponentsSmall,
      zkComponentsLarge
    );
  }

  // It is expected that parameters are passed with the same indices of arrays.
  public static async deployOpenVBridge(
    chains: LocalChain[],
    tokens: MintableToken[],
    wallets: ethers.Wallet[]
  ): Promise<OpenVBridge> {
    console.log('here')
    let assetRecord: Record<number, string[]> = {};
    let deployers: Record<number, ethers.Wallet> = {};
    let governors: Record<number, string> = {};
    let chainIdsArray: number[] = [];

    for (let i=0; i<chains.length; i++) {
      wallets[i].connect(chains[i].provider());
      assetRecord[chains[i].chainId] = [tokens[i].contract.address];
      deployers[chains[i].chainId] = wallets[i];
      governors[chains[i].chainId] = await wallets[i].getAddress();
      chainIdsArray.push(chains[i].chainId);
    }

    const bridgeInput: VBridgeInput = {
      vAnchorInputs: {
        asset: assetRecord,
      },
      chainIDs: chainIdsArray,
      webbTokens: new Map()
    }
    console.log('bridgeInput: ', bridgeInput)
    const deployerConfig = { 
      ...deployers
    }
    console.log('deployerConfig: ', deployerConfig)
    const governorConfig = {
      ...governors
    }
    console.log('governorConfig: ', governorConfig)

    return OpenVBridge.deployVariableAnchorBridge(
      bridgeInput,
      deployerConfig,
      governorConfig,
    );
  }
}
