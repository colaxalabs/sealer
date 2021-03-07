import { ethers } from 'hardhat'
import { BigNumberish, Signer } from 'ethers'

const abiCoder = ethers.utils.defaultAbiCoder

export const signProperty = async(
  _token: number,
  _title: string,
  _docHash: string,
  _size: BigNumberish,
  _unit: string,
  _signer: Signer
) => {
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

export const signClaim = async(titleNo: string, tokenId: number, signer: Signer) => {
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

export const tenantSignsAgreement = async(purposeForRent: string, rentSize: BigNumberish, duration: number, durationCost: BigNumberish, tokenId: number, tenant: Signer) => {
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

export const signUsageClaim = async(title: string, tokenId: number, claimer: Signer) => {
  // encode payload
  const payload = abiCoder.encode(['string', 'uint'], [title, tokenId])
  // hash payload
  const payloadHash = ethers.utils.keccak256(payload)
  // convert payload 32 bytes hash to Uint8Array
  const payloadMessage = ethers.utils.arrayify(payloadHash)
  // claimer signature
  const claimerSign = await claimer.signMessage(payloadMessage)
  return claimerSign
}
