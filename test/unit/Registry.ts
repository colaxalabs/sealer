import { ethers } from 'hardhat'
import { Signer, Contract } from 'ethers'
const { expect } = require('chai')

const zero = ethers.constants.Zero
const tokenId = 32012223
const abiCoder = ethers.utils.defaultAbiCoder
const size = ethers.utils.parseUnits('0.35', 18)

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

  it('Should attest title property and emit Attestation event', async() => {
    // encode property data for signing
    const payload = abiCoder.encode(
      ['uint', 'string', 'string', 'uint', 'string'],
      [tokenId,  '111/v0/43x/50300', 'QmUfideC1r5JhMVwgd8vjC7DtVnXw3QGfCSQA7fUVHK789', size, 'ha']
    )
    // hash payload
    const payloadHash = ethers.utils.keccak256(payload)
    // sign encoded property data
    // generate 32 bytes of data as Uint8Array
    const payloadMessage = ethers.utils.arrayify(payloadHash)
    const attestor = await accounts[2].signMessage(payloadMessage)
    // recover signer
    const sig = ethers.utils.splitSignature(attestor)
    const signer = ethers.utils.verifyMessage(payloadMessage, sig)
    await expect(registry.connect(accounts[2]).attestProperty(tokenId,  '111/v0/43x/50300', 'QmUfideC1r5JhMVwgd8vjC7DtVnXw3QGfCSQA7fUVHK789', size, 'ha', attestor)).to.emit(registry, 'Attestation').withArgs('111/v0/43x/50300', 'QmUfideC1r5JhMVwgd8vjC7DtVnXw3QGfCSQA7fUVHK789', size, 'ha', signer) 
  })

  it('Should not attest duplicate property', async() => {})
})
