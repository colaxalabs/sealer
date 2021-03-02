import { ethers } from 'hardhat'
import { Signer, Contract, BigNumberish } from 'ethers'
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
const tenantSize = ethers.utils.parseUnits('0.15', 18)
const overSize = ethers.utils.parseUnits('0.50', 18)
const cost = ethers.utils.parseUnits('250.75', 18)
const rentDuration = Math.floor(Date.now() / 1000) + (86400 * 14)
const restrictedDuration = Math.floor(Date.now() / 1000) - (86400 * 13)
const rentPurpose = 'Avocado season planting'

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

async function signProperty(
  _token: number,
  _title: string,
  _docHash: string,
  _size: BigNumberish,
  _unit: string,
  _signer: Signer
) {
  // encode property data for signing
  const payload = abiCoder.encode(
    ['uint', 'string', 'string', 'uint', 'string'],
    [_token,  _title, _docHash, _size, _unit]
  )
  // hash payload
  const payloadHash = ethers.utils.keccak256(payload)
  // sign encoded property data
  // generate 32 bytes of data as Uint8Array
  const payloadMessage = ethers.utils.arrayify(payloadHash)
  const attestor = await _signer.signMessage(payloadMessage)
  // recover signer
  const sig = ethers.utils.splitSignature(attestor)
  const signer = ethers.utils.verifyMessage(payloadMessage, sig)
  return { attestor, signer }
}

async function signClaim(titleNo: string, signer: Signer) {
  // encode payload
  const payload = abiCoder.encode(['string'], [titleNo])
  // hash payload
  const payloadHash = ethers.utils.keccak256(payload)
  // convert 32 bytes hash to Uint8Array
  const payloadMessage = ethers.utils.arrayify(payloadHash)
  // sign payload message
  const claimer = await signer.signMessage(payloadMessage)
  return claimer
}

async function ownerSignsAgreement(purposeForRent: string, rentSize: BigNumberish, duration: number, durationCost: BigNumberish, titleNo: string, owner: Signer) {
  // encode payload
  const payload = abiCoder.encode(
    ['string', 'uint', 'uint', 'uint', 'string'],
    [purposeForRent, rentSize, duration, durationCost, titleNo]
  )
  // hash payload
  const payloadHash = ethers.utils.keccak256(payload)
  // convert payload 32 bytes hash to Uint8Array
  const payloadMessage = ethers.utils.arrayify(payloadHash)
  // owner signature
  const ownerSign = await owner.signMessage(payloadMessage)
  return ownerSign
}

async function tenantSignsAgreement(purposeForRent: string, rentSize: BigNumberish, duration: number, durationCost: BigNumberish, titleNo: string, tenant: Signer) {
  // encode payload
  const payload = abiCoder.encode(
    ['string', 'uint', 'uint', 'uint', 'string'],
    [purposeForRent, rentSize, duration, durationCost, titleNo]
  )
  // hash payload
  const payloadHash = ethers.utils.keccak256(payload)
  // convert payload 32 bytes hash to Uint8Array
  const payloadMessage = ethers.utils.arrayify(payloadHash)
  // tenant signature
  const tenantSign = await tenant.signMessage(payloadMessage)
  return tenantSign
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

describe('Registry:Agreement#totalPrevAgreements', () => {

  before('setup Registry contract', setupContract);

  it('Should revert getting previous agreements for account with zero address', async() => {
    await expect(registry.totalPrevAgreements(addressZero)).to.be.revertedWith('REGISTRY: zero address')
  })

  it('Should get total previous agreement for an account', async() => {
    const who = await accounts[2].getAddress()
    expect(await registry.totalPrevAgreements(who)).to.eq(zero)
  })
})

describe('Registry:Agreement#agreementAt', () => {

  before('setup Registry contract', setupContract)

  it('Should revert query agreement for zero address', async() => {
    await expect(registry.agreementAt(addressZero, 0)).to.be.revertedWith('REGISTRY: zero address')
  })

  it('Should revert query agreement for index gt current total previous agreements', async() => {
    const who = await accounts[3].getAddress()
    await expect(registry.agreementAt(who, 1)).to.be.revertedWith('REGISTRY: index out of range')
  })

  it('Should get previous agreement for an account at an index correctly', async() => {
    const who = await accounts[4].getAddress()
    const resp = await registry.agreementAt(who, 0) // returns a tuple of values
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
      title,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      title,
      accounts[3],
    )
    await expect(
      registry.sealAgreement(
        rentPurpose,
        tenantSize,
        rentDuration,
        cost,
        title2,
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
      title,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      title,
      accounts[3],
    )
    await expect(
      registry.sealAgreement(
        rentPurpose,
        overSize,
        rentDuration,
        cost,
        title,
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
      title2,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      title,
      accounts[3],
    )
    await expect(
      registry.sealAgreement(
        rentPurpose,
        tenantSize,
        rentDuration,
        cost,
        title,
        ownerSign,
        tenantSign
      )
    ).to.be.revertedWith('invalid owner signature')
  })

  it('Should revert unauthenticated tenant', async() => {
    const ownerSign = await ownerSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      title,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      title2,
      accounts[3],
    )
    await expect(
      registry.sealAgreement(
        rentPurpose,
        tenantSize,
        rentDuration,
        cost,
        title,
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
      title,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      title,
      accounts[3],
    )
    await registry.connect(accounts[3]).sealAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      title,
      ownerSign,
      tenantSign
    )
    await expect(
      registry.connect(accounts[3]).sealAgreement(
        rentPurpose,
        tenantSize,
        restrictedDuration,
        cost,
        title,
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
      title,
      accounts[2],
    )
    const tenantSign = await tenantSignsAgreement(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      title,
      accounts[3],
    )
    await expect(
      registry.connect(accounts[3]).sealAgreement(
        rentPurpose,
        tenantSize,
        rentDuration,
        cost,
        title,
        ownerSign,
        tenantSign
      )
    ).to.emit(registry, 'Sealed').withArgs(
      rentPurpose,
      tenantSize,
      rentDuration,
      cost,
      title,
      ownerSign,
      tenantSign,
      tokenId
    )
  })
})

