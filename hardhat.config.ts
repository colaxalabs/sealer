require('dotenv').config()
import { HardhatUserConfig } from 'hardhat/config'

import '@nomiclabs/hardhat-waffle'
import 'solidity-coverage'
import 'hardhat-gas-reporter'

require('./scripts/deploy.ts')

export default {
  networks: {
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.ACCOUNT_KEYS]
    },
  },
  solidity: {
    version: "0.8.0",
  },
  gasReporter: {
    currency: 'USD',
    enabled: process.env.REPORT_GAS ? true : false,
  },
} as HardhatUserConfig
