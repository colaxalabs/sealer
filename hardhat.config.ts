import { HardhatUserConfig } from 'hardhat/config'

import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-ethers'

require('./scripts/deploy.ts')

export default {
  solidity: {
    version: "0.8.0",
  },
} as HardhatUserConfig;
