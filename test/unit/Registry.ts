import { ethers } from 'hardhat'
import { Signer, Contract, BigNumberish } from 'ethers'
import { signProperty, signClaim } from '../utils/crypto'
const { expect } = require('chai')

const zero = ethers.constants.Zero
const addressZero = ethers.constants.AddressZero
const tokenId = 32012223
const tokenId2 = 431293
const ipfsHash = 'QmUfideC1r5JhMVwgd8vjC7DtVnXw3QGfCSQA7fUVHK789'
const ipfsHash2 = 'QmUideC1r5JhMVwgd8vjC7DtVnXw3QGfCSQA7fUVHK789'
const ipfsHash3 = 'QmlUideC1r5JhMVwgd8vjC7DtVnXw3QGfCSQA7fUVHK789'
const title = '111/v0/43x/50300'
const title2 = '111/v0/43x/4932'
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
    const totals = await registry.totalLands()

    expect(totals).to.equal(zero)
  })

  it('Should get total farms for an account', async() => {
    expect(await registry.landCount(await accounts[2].getAddress())).to.eq(zero)
  })
})

describe('Registry:Attest Property', () => {
  before('setup Registry contract', setupContract)

  it('Should attest title property and emit Attestation event', async() => {
    const { attestor, signer } = await signProperty(tokenId, title, ipfsHash, size, 'ha', accounts[2]) 
    await expect(
      registry.connect(accounts[2]).attestProperty(
        tokenId,
        title,
        ipfsHash,
        size,
        'ha',
        attestor
      )
    ).to.emit(
      registry,
      'Attestation'
    ).withArgs(
      tokenId,
      title,
      ipfsHash,
      size,
      'ha',
      signer
    )
  })

  it('Should not attest duplicate property', async() => {
    const { attestor, signer } = await signProperty(tokenId, title, ipfsHash, size, 'ha', accounts[2]) 
    await expect(
      registry.connect(accounts[2]).attestProperty(
        tokenId,
        title,
        ipfsHash,
        size,
        'ha',
        attestor
      )
    ).to.be.revertedWith('REGISTRY: duplicate title document')
  })

  it('Should not attest duplicate property tokenId', async() => {
    const { attestor, signer } = await signProperty(tokenId, title2, ipfsHash2, size, 'ha', accounts[2]) 
    await expect(
      registry.connect(accounts[2]).attestProperty(
        tokenId,
        title2,
        ipfsHash2,
        size,
        'ha',
        attestor
      )
    ).to.be.revertedWith('ERC721: token already minted')
  })

  it('Should not attest invalid property data signed', async() => {
    const { attestor } = await signProperty(tokenId2, title2, ipfsHash2, size, 'ha', accounts[2])
    await expect(
      registry.connect(accounts[2]).attestProperty(
        tokenId2,
        title,
        ipfsHash2,
        size,
        'ha',
        attestor
      )
    ).to.be.revertedWith('REGISTRY: cannot authenticate signer')
  })
})

describe('Registry:Claim Ownership', () => {

  before('setup Registry contract', async() => {
    await setupContract()
    const { attestor } = await signProperty(tokenId, title, ipfsHash, size, 'ha', accounts[2])
    await registry.connect(accounts[2]).attestProperty(tokenId, title, ipfsHash, size, 'ha', attestor)
  })

  it('Should attest ownership to property', async() => {
    const claimer = await signClaim(title, accounts[2])
    expect(await registry.connect(accounts[2]).claimOwnership(title, claimer)).to.be.true
  })

  it('Should panic attest with wrong signer', async() => {
    const claimer = await signClaim(title, accounts[3])
    expect(await registry.connect(accounts[3]).claimOwnership(title, claimer)).to.be.false
  })

  it('Should panic attest with nonexistent property title', async() => {
    const claimer = await signClaim(title, accounts[2])
    await expect(registry.connect(accounts[2]).claimOwnership(title2, claimer)).to.be.revertedWith('REGISTRY: nonexistent title')
  })
})

