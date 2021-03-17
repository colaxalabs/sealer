import { task } from 'hardhat/config'
const fs = require('fs')

task('sealer:deploy', 'Deploy Sealer contracts').setAction(
        async(args, hre) => {

                // get signer
                const [deployer] = await hre.ethers.getSigners()
                console.log('Deployer address', await deployer.getAddress())

                // deploy token contract
                const token = await (
                        await hre.ethers.getContractFactory('ERC721')
                )
                .connect(deployer)
                .deploy()
                console.log('Token deployed at ', token.address)

                // deploy registry contract
                const registry = await (
                        await hre.ethers.getContractFactory('Registry')
                )
                .connect(deployer)
                .deploy(token.address)
                console.log('Registry deployed at ', registry.address)

                // deploy agreement contract
                const agreement = await (
                        await hre.ethers.getContractFactory('PropertyUsage')
                )
                .connect(deployer)
                .deploy(registry.address, token.address)
                console.log('Agreement deployed at ', agreement.address)

                // save contract's artifacts and address to frontend
                saveToFrontEnd(token, registry, agreement)
        }
)

function saveToFrontEnd(token, registry, agreement) {
        const contractDir = '/home/lomolo/Projects/galva/src/contracts'

        // Check if file path exists
        if (!fs.existsSync(contractDir)) {
                // Create file path
                fs.mkdirSync(contractDir)
        }

        // write contract deployed addresses
        fs.writeFileSync(
                contractDir + '/contract_address.json',
                JSON.stringify({ Token: token.address, Registry: registry.address, Agreement: agreement.address }, undefined, 2)
        )

        // write contract's artifacts
        const tokenArtifactsDir = require(__dirname + '/../artifacts/contracts/token/ERC721.sol/ERC721.json')
        const registryArtifactsDir = require(__dirname + '/../artifacts/contracts/registry/Registry.sol/Registry.json')
        const agreementArtifactsDir = require(__dirname + '/../artifacts/contracts/agreement/Agreement.sol/PropertyUsage.json')

        fs.writeFileSync(
                contractDir + '/Token.json',
                JSON.stringify(tokenArtifactsDir, null, 2)
        )
        console.log('---------')
        console.log('Token artifacts saved!')

        fs.writeFileSync(
                contractDir + '/Registry.json',
                JSON.stringify(registryArtifactsDir, null, 2)
        )
        console.log('---------')
        console.log('Registry artifacts saved!')

        fs.writeFileSync(
                contractDir + '/Agreement.json',
                JSON.stringify(agreementArtifactsDir, null, 2)
        )
        console.log('---------')
        console.log('Agreement artifacts saved!')
}
