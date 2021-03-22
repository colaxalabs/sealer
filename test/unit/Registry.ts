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
    const claimer = await signClaim(title, tokenId, accounts[2])
    expect(await registry.connect(accounts[2]).claimOwnership(title, tokenId, claimer)).to.be.true
  })

  it('Should panic attest with wrong signer', async() => {
    const claimer = await signClaim(title, tokenId, accounts[3])
    expect(await registry.connect(accounts[3]).claimOwnership(title, tokenId, claimer)).to.be.false
  })
})

describe('Registry#accountProperty', () => {
  before('setup Registry contract', async() => {
    await setupContract()
    const { attestor } = await signProperty(tokenId, title, ipfsHash, size, 'ha', accounts[2])
    await registry.connect(accounts[2]).attestProperty(tokenId, title, ipfsHash, size, 'ha', attestor)
  })

  it('Should panic getting total properties for zero address', async() => {
    await expect(token.balanceOf(addressZero)).to.be.revertedWith('ERC721: balance query for zero address')
  })

  it('Should panic getting property for zero address', async() => {
    await expect(registry.accountProperty(addressZero, 1)).to.be.reverted
  })

  it('Should get total properties attested by user account', async() => {
    const count = (await token.balanceOf(await accounts[2].getAddress())).toString()
    expect(count).to.eq('1')
  })

  it('Should panic get property with invalid index', async() => {
    await expect(registry.accountProperty(await accounts[2].getAddress(), 2)).to.be.revertedWith('index out of range')
  })

  it('Should get all properties belonging to an account', async() => {
    const address = await accounts[2].getAddress()
    let properties = []
    const totalCount = Number(await token.balanceOf(address))
    let property = {}
    let resp
    expect(totalCount).to.eq(1)
    for (let i = 1; i <= totalCount; i++) {
      resp = await registry.accountProperty(address, i)
      property['tokenId'] = resp[0]
      property['title'] = resp[1]
      property['titleDocument'] = resp[2]
      property['size'] = resp[3]
      property['unit'] = resp[4]
      property['attestor'] = resp[5]
      properties[i-1] = property
    }
    expect(properties.length).to.eq(1)
  })
})

describe('Registry#getProperty', () => {
  before('setup Registry contract', async() => {
    await setupContract()
    const { attestor } = await signProperty(tokenId, title, ipfsHash, size, 'ha', accounts[2])
    await registry.connect(accounts[2]).attestProperty(tokenId, title, ipfsHash, size, 'ha', attestor)
  })

  it('Should return property for non-tokenized id', async() => {
    const resp = await registry.getProperty(324)
    expect(resp.length).to.eq(5)
    expect(resp[0]).to.eq(ethers.BigNumber.from(0))
    expect(resp[4]).to.eq(addressZero)
  })

  it('Should return property for tokenized id', async() => {
    const resp = await registry.getProperty(tokenId)
    expect(resp.length).to.eq(5)
    expect(resp[0]).to.eq(ethers.BigNumber.from(tokenId))
    expect(resp[4]).to.eq(await accounts[2].getAddress())
  })
})

