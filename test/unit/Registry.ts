import { ethers } from 'hardhat'
import { Signer, Contract } from 'ethers'
const { expect } = require('chai')

const zero = ethers.constants.Zero
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

async function registerProperty(id: number, hash: string) {
  // encode property data for signing
  const payload = abiCoder.encode(
    ['uint', 'string', 'string', 'uint', 'string'],
    [id,  title, hash, size, 'ha']
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
  await expect(
    registry.connect(accounts[2]).attestProperty(
      id,
      title,
      hash,
      size,
      'ha',
      attestor
    )
  ).to.emit(
    registry,
    'Attestation'
  ).withArgs(
    id,
    title,
    hash,
    size,
    'ha',
    signer
  )
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
    await registerProperty(tokenId, ipfsHash) 
  })

  it('Should not attest duplicate property', async() => {
    await expect(
      registerProperty(tokenId, ipfsHash)
    ).to.be.revertedWith('REGISTRY: duplicate title document')
  })

  it('Should not attest duplicate property tokenId', async() => {
    await expect(
      registerProperty(tokenId, ipfsHash2)
    ).to.be.revertedWith('ERC721: token already minted')
  })

  it('Should not attest different property data signed', async() => {
    // encode property data for signing
    const payload = abiCoder.encode(
      ['uint', 'string', 'string', 'uint', 'string'],
      [tokenId,  title, 'QmUideC1r5JhMVwgd8vjC7DtVnXw3QGfCSQA7fUVHK789', size, 'ha']
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
    await expect(
      registry.connect(accounts[2]).attestProperty(
        tokenId2,
        title,
        ipfsHash3,
        size,
        'ha',
        attestor
      )
    ).to.be.revertedWith('REGISTRY: cannot authenticate signer')
  })
})

describe('Registry:Claim Ownership', () => {

  before('setup Registry contract', setupContract)

  it('Should attest ownership to property title', async() => {
    await registerProperty(tokenId, ipfsHash)
    // encode payload
    const payload = abiCoder.encode(['string'], [title])
    // hash payload
    const payloadHash = ethers.utils.keccak256(payload)
    // generate 32 bytes message to sign
    const payloadMessage = ethers.utils.arrayify(payloadHash)
    const attestor = await accounts[2].signMessage(payloadMessage)
    expect(await registry.connect(accounts[2]).claimOwnership(title, attestor)).to.be.true
  })

  it('Should panic attest with wrong signer', async() => {
    // encode payload
    const payload = abiCoder.encode(['string'], [title2])
    // hash payload
    const payloadHash = ethers.utils.keccak256(payload)
    // generate 32 bytes message to sign
    const payloadMessage = ethers.utils.arrayify(payloadHash)
    const attestor = await accounts[2].signMessage(payloadMessage)
    expect(await registry.connect(accounts[2]).claimOwnership(title, attestor)).to.be.false
  })

  it('Should panic attest with nonexistent property title', async() => {
    // encode payload
    const payload = abiCoder.encode(['string'], [title2])
    // hash payload
    const payloadHash = ethers.utils.keccak256(payload)
    // generate 32 bytes message to sign
    const payloadMessage = ethers.utils.arrayify(payloadHash)
    const attestor = await accounts[2].signMessage(payloadMessage)
    await expect(
      registry.connect(accounts[2]).claimOwnership(
        title2,
        attestor
      )
    ).to.be.revertedWith('REGISTRY: nonexistent title')
  })
})
