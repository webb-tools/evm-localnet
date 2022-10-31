import { fetchComponentsFromFilePaths, ZkComponents } from "@webb-tools/utils";
import path from "path";

export async function getZkComponents(numSides: number) {
    const isEightSided = numSides > 2;

    let zkComponentsSmall: ZkComponents;
    let zkComponentsLarge: ZkComponents;
  
    if (isEightSided) {
      zkComponentsSmall = await fetchComponentsFromFilePaths(
        path.resolve(__dirname, './solidity-fixtures/vanchor_2/8/poseidon_vanchor_2_8.wasm'),
        path.resolve(__dirname, './solidity-fixtures/vanchor_2/8/witness_calculator.cjs'),
        path.resolve(__dirname, './solidity-fixtures/vanchor_2/8/circuit_final.zkey')
      );
  
      zkComponentsLarge = await fetchComponentsFromFilePaths(
        path.resolve(__dirname, './solidity-fixtures/vanchor_16/8/poseidon_vanchor_16_8.wasm'),
        path.resolve(__dirname, './solidity-fixtures/vanchor_16/8/witness_calculator.cjs'),
        path.resolve(__dirname, './solidity-fixtures/vanchor_16/8/circuit_final.zkey')
      );
    } else {
      zkComponentsSmall = await fetchComponentsFromFilePaths(
        path.resolve(__dirname, './solidity-fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm'),
        path.resolve(__dirname, './solidity-fixtures/vanchor_2/2/witness_calculator.cjs'),
        path.resolve(__dirname, './solidity-fixtures/vanchor_2/2/circuit_final.zkey')
      );
  
      zkComponentsLarge = await fetchComponentsFromFilePaths(
        path.resolve(__dirname, './solidity-fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm'),
        path.resolve(__dirname, './solidity-fixtures/vanchor_16/2/witness_calculator.cjs'),
        path.resolve(__dirname, './solidity-fixtures/vanchor_16/2/circuit_final.zkey')
      );
    }

  return {
    smallFixtures: zkComponentsSmall,
    largeFixtures: zkComponentsLarge
  }
}
