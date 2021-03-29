require("dotenv").config();
import { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-waffle";
import "solidity-coverage";
import "hardhat-gas-reporter";

require("./scripts/deploy.ts");

export default {
  networks: {
    buidlerevm: {
      url: "http://localhost:8545",
      gas: 1e8,
      blockGasLimit: 1e8,
    },
    ganache: {
      url: "http://localhost:8545",
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.ACCOUNT_KEYS],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.7.3",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.2",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  gasReporter: {
    currency: "KES",
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COIN_MARKET_API,
  },
} as HardhatUserConfig;
