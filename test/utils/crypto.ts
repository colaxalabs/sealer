import { ethers } from 'hardhat'
import { BigNumberish, Signer } from 'ethers'

const abiCoder = ethers.utils.defaultAbiCoder

export const signProperty = async(
  _token: BigNumberish,
  _docHash: string,
  _size: BigNumberish,
  _signer: Signer
) => {
  // encode property data for signing
  const payload = abiCoder.encode(
    ['uint', 'string', 'uint'],
    [_token, _docHash, _size]
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

export const signClaim = async(titleNo: string, tokenId: BigNumberish, signer: Signer) => {
  // encode payload
  const payload = abiCoder.encode(['string', 'uint'], [titleNo, tokenId])
  // hash payload
  const payloadHash = ethers.utils.keccak256(payload)
  // convert 32 bytes hash to Uint8Array
  const payloadMessage = ethers.utils.arrayify(payloadHash)
  // sign payload message
  const claimer = await signer.signMessage(payloadMessage)
  return claimer
}

export const ownerSignsAgreement = async(purposeForRent: string, rentSize: BigNumberish, duration: number, durationCost: BigNumberish, tokenId: number, owner: Signer) => {
  // encode payload
  const payload = abiCoder.encode(
    ['string', 'uint', 'uint', 'uint', 'uint'],
    [purposeForRent, rentSize, duration, durationCost, tokenId]
  )
  // hash payload
  const payloadHash = ethers.utils.keccak256(payload)
  // convert payload 32 bytes hash to Uint8Array
  const payloadMessage = ethers.utils.arrayify(payloadHash)
  // owner signature
  const ownerSign = await owner.signMessage(payloadMessage)
  return ownerSign
}

export const tenantSignsAgreement = async(purposeForRent: string, rentSize: BigNumberish, duration: BigNumberish, durationCost: BigNumberish, tokenId: BigNumberish, tenant: Signer) => {
  // encode payload
  const payload = abiCoder.encode(
    ['string', 'uint', 'uint', 'uint', 'uint'],
    [purposeForRent, rentSize, duration, durationCost, tokenId]
  )
  // hash payload
  const payloadHash = ethers.utils.keccak256(payload)
  // convert payload 32 bytes hash to Uint8Array
  const payloadMessage = ethers.utils.arrayify(payloadHash)
  // tenant signature
  const tenantSign = await tenant.signMessage(payloadMessage)
  return tenantSign
}

export const signUsageClaim = async(purpose: BigNumberish, size: BigNumberish, duration: BigNumberish, cost: BigNumberish, tokenId: BigNumberish, claimer: Signer) => {
  // encode payload
  const payload = abiCoder.encode(['string', 'uint', 'uint', 'uint', 'uint'], [purpose, size, duration, cost, tokenId])
  // hash payload
  const payloadHash = ethers.utils.keccak256(payload)
  // convert payload 32 bytes hash to Uint8Array
  const payloadMessage = ethers.utils.arrayify(payloadHash)
  // claimer signature
  const claimerSign = await claimer.signMessage(payloadMessage)
  return claimerSign
}

export const increaseTime = async(seconds: BigNumberish) => {
  const now = (await ethers.provider.getBlock('latest')).timestamp
  await ethers.provider.send('evm_mine', [
    ethers.BigNumber.from(seconds).add(now).toNumber(),
  ])
}
