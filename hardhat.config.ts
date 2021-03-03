import { HardhatUserConfig } from 'hardhat/config'

import '@nomiclabs/hardhat-waffle'

require('./scripts/deploy.ts')

export default {
  solidity: {
    version: "0.8.0",
  },
} as HardhatUserConfig
