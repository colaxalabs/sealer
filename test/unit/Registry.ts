import { ethers } from 'hardhat'
import { Signer, Contract } from 'ethers'
const { expect } = require('chai')

const zero = ethers.BigNumber.from(0)

let accounts: Signer[],
  registry: Contract,
  token: Contract

async function setupContract() {
  // get signers
  accounts = await ethers.getSigners()
  // deploy ERC721
  const Token = await ethers.getContractFactory('ERC721')
  token = await Token.deploy()
  // deploy Registry
  const Registry = await ethers.getContractFactory('Registry')
  registry = await Registry.deploy(token.address)
}

describe("Registry", () => {
  before('setup Registry contract', setupContract)

  it('Should reject any ether send to it', async() => {
    const user = accounts[1]
    await expect(user.sendTransaction({ to: registry.address, value: 1 })).to.be.reverted
  })
})

describe('Registry:Initialization', () => {
  before('setup Registry contract', setupContract)

  it('Should get total farms registered', async() => {
    const totals = await registry.totalFarms()

    expect(totals).to.equal(zero)
  })

  it('Should get total farms for an account', async() => {
    expect(await registry.landCount(await accounts[2].getAddress())).to.eq(zero)
  })
})

describe('Registry:Attest Property', () => {
  before('setup Registry contract', setupContract)

  it('Should attest title property and emit Attestation event', async() => {})
})
