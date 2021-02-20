import { task } from 'hardhat/config'
import '@nomiclabs/hardhat-waffle'

task('sealer:deploy', 'Deploy sealer contracts').setAction(
  async(args, bre) => {
    console.log(args)

    // get signers
    const deployer = (await bre.ethers.getSigners())[0]

    // deploy ERC721
    const erc721 = await(
      await bre.ethers.getContractFactory('ERC721')
    ).deploy()
    console.log(`ERC721 deployed at ${erc721.address}`)

    // deploy Registry
    const registry = await (
      await bre.ethers.getContractFactory('Registry')
    ).deploy(erc721.address)
    console.log(`Registry deployed at ${registry.address}`)
  }
)
