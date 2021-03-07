import { ethers } from 'hardhat'
import { Signer, Contract } from 'ethers'
import { signProperty, ownerSignsAgreement, tenantSignsAgreement, signUsageClaim } from '../utils/crypto'
const { expect } = require('chai')

const zero = ethers.constants.Zero
const addressZero = ethers.constants.AddressZero
const title = '111/v0/43x/50300'
const title2 = '111/v0/43x/4932'
const title3 = '343/tr/8y'
const ipfsHash = 'QmUfideC1r5JhMVwgd8vjC7DtVnXw3QGfCSQA7fUVHK789'
const ipfsHash2 = 'QmUfideC1r5JhMVwgd8vjC7DtVnXw3QGfCSQA7fUVHK749'
const tokenId = 32012223
const tokenId2 = 4772832
const size = ethers.utils.parseUnits('0.35', 18)
const tenantSize = ethers.utils.parseUnits('0.15', 18)
const overSize = ethers.utils.parseUnits('0.50', 18)
const cost = ethers.utils.parseUnits('250.75', 18)
const rentDuration = Math.floor(Date.now() / 1000) + (86400 * 14)
const restrictedDuration = Math.floor(Date.now() / 1000) - (86400 * 13)
const rentPurpose = 'Avocado season planting'

let accounts: Signer[],
  token: Contract,
  registry: Contract,
  usage: Contract

async function setupContract() {
  // get signers
  accounts = await ethers.getSigners()
  // deploy ERC721
  const Token = await ethers.getContractFactory('ERC721')
  token = await Token.deploy()
  // deploy Registry
  const Registry = await ethers.getContractFactory('Registry')
  registry = await Registry.deploy(token.address)
  // deploy Agreement
  const Usage = await ethers.getContractFactory('PropertyUsage')
  usage = await Usage.deploy(registry.address, token.address)
}

describe('Registry:Agreement#totalPrevAgreements', () => {

  before('setup Registry contract', setupContract);

  it('Should revert getting previous agreements for account with zero address', async() => {
    await expect(usage.totalPrevAgreements(addressZero)).to.be.revertedWith('REGISTRY: zero address')
  })

  it('Should get total previous agreement for an account', async() => {
    const who = await accounts[2].getAddress()
    expect(await usage.totalPrevAgreements(who)).to.eq(zero)
  })
})

describe('Registry:Agreement#agreementAt', () => {

  before('setup Registry contract', setupContract)

  it('Should revert query agreement for zero address', async() => {
    await expect(usage.agreementAt(addressZero, 0)).to.be.revertedWith('REGISTRY: zero address')
  })

  it('Should revert query agreement for index gt current total previous agreements', async() => {
    const who = await accounts[3].getAddress()
    await expect(usage.agreementAt(who, 1)).to.be.revertedWith('REGISTRY: index out of range')
  })

  it('Should get previous agreement for an account at an index correctly', async() => {
    const who = await accounts[4].getAddress()
    const resp = await usage.agreementAt(who, 0) // returns a tuple of values
    expect(resp.length).to.eq(7)
    expect(resp[1].toNumber()).to.eq(0)
  })
})

describe('Registry:Agreement#sealAgreement', () => {

  before('setup Registry contract', async() => {
    await setupContract()
    const { attestor } = await signProperty(tokenId, title, ipfsHash, size, 'ha', accounts[2])
    await registry.connect(accounts[2]).attestProperty(tokenId, title, ipfsHash, size, 'ha', attestor)
  })

  it('Should revert sealing agreement for nonexistent property', async() => {
    const ownerSign = await ownerSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[3],
    )
    await expect(
      usage.sealAgreement(
        rentPurpose,
        tenantSize,
        rentDuration,
        cost,
        tokenId2,
        ownerSign,
        tenantSign
      )
    ).to.be.reverted
  })

  it('Should revert sealing agreement with greater size', async() => {
    const ownerSign = await ownerSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[3],
    )
    await expect(
      usage.sealAgreement(
        rentPurpose,
        overSize,
        rentDuration,
        cost,
        tokenId,
        ownerSign,
        tenantSign
      )
    ).to.be.reverted
  })

  it('Should revert unauthenticated owner', async() => {
    const ownerSign = await ownerSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId2,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[3],
    )
    await expect(
      usage.sealAgreement(
        rentPurpose,
        tenantSize,
        rentDuration,
        cost,
        tokenId,
        ownerSign,
        tenantSign
      )
    ).to.be.revertedWith('cannot authenticate owner')
  })

  it('Should revert unauthenticated tenant', async() => {
    const ownerSign = await ownerSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId2,
      accounts[3],
    )
    await expect(
      usage.sealAgreement(
        rentPurpose,
        tenantSize,
        rentDuration,
        cost,
        tokenId,
        ownerSign,
        tenantSign
      )
    ).to.be.revertedWith('cannot authenticate tenant')
  })

  it('Should revert if latest agreement is not fullfilled', async() => {
    const ownerSign = await ownerSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[3],
    )
    await usage.connect(accounts[3]).sealAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      ownerSign,
      tenantSign
    )
    await expect(
      usage.connect(accounts[3]).sealAgreement(
        rentPurpose,
        tenantSize,
        restrictedDuration,
        cost,
        tokenId,
        ownerSign,
        tenantSign
      )
    ).to.be.revertedWith('latest running agreement')
  })

  it('Should seal agreement correctly', async() => {
    await setupContract()
    const { attestor } = await signProperty(tokenId, title, ipfsHash, size, 'ha', accounts[2])
    await registry.connect(accounts[2]).attestProperty(tokenId, title, ipfsHash, size, 'ha', attestor)
    const ownerSign = await ownerSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[3],
    )
    await expect(
      usage.connect(accounts[3]).sealAgreement(
        rentPurpose,
        tenantSize,
        rentDuration,
        cost,
        tokenId,
        ownerSign,
        tenantSign
      )
    ).to.emit(usage, 'Sealed').withArgs(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      title,
      await accounts[2].getAddress(),
      await accounts[3].getAddress(),
      tokenId
    )
    expect(await usage.getRights(tokenId)).to.eq(size.sub(tenantSize))
  })
})

describe('Registry:Agreement#claimUsageRights', () => {

  before('setup Agreement contract', async() => {
    await setupContract()
    const { attestor } = await signProperty(tokenId, title, ipfsHash, size, 'ha', accounts[2])
    const signer2 = await signProperty(tokenId2, title2, ipfsHash2, size, 'acres', accounts[2])
    await registry.connect(accounts[2]).attestProperty(tokenId, title, ipfsHash, size, 'ha', attestor)
    await registry.connect(accounts[2]).attestProperty(tokenId2, title2, ipfsHash2, size, 'acres', signer2.attestor)
    const ownerSign = await ownerSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[3],
    )
    await usage.connect(accounts[3]).sealAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      ownerSign,
      tenantSign
    )
  })

  it('Should revert claiming unauthorized usage on attested property title', async() => {
    const claimerSign = await signUsageClaim(title2, tokenId2, accounts[3])
    const resp = await usage.claimUsageRights(title2, tokenId2, claimerSign)
    expect(resp.length).to.eq(3)
    expect(resp[0]).to.be.false
    expect(resp[1].toNumber()).not.to.eq(zero)
    expect(resp[2]).to.eq(title)
  })

  it('Should claim usage rights correctly', async() => {
    const claimerSign = await signUsageClaim(title, tokenId, accounts[3])
    const resp = await usage.claimUsageRights(title, tokenId, claimerSign)
    expect(resp.length).to.eq(3)
    expect(resp[0]).to.be.true
    expect(resp[1].toNumber()).to.eq(rentDuration)
    expect(resp[2]).to.eq(title)
  })
})

describe('Agreement#getRights', () => {
  before('setup Agreement contract', async() => {
    await setupContract()
    const { attestor } = await signProperty(tokenId, title, ipfsHash, size, 'ha', accounts[2])
    await registry.connect(accounts[2]).attestProperty(tokenId, title, ipfsHash, size, 'ha', attestor)
  })

  it('Should revert getting rights for non-claimed property rights', async() => {
    await expect(usage.getRights(tokenId)).to.be.reverted
  })

  it('Should claim property rights correctly', async() => {
    const ownerSign = await ownerSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      accounts[3],
    )
    await usage.connect(accounts[3]).sealAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      tokenId,
      ownerSign,
      tenantSign
    )
    expect(await usage.getRights(tokenId)).to.eq(size.sub(tenantSize))
  })

  it('Should return remaining property rights to claim', async() => {
    expect(await usage.getRights(tokenId)).to.eq(size.sub(tenantSize))
  })
})
