import { ethers } from 'hardhat'
import { Signer, Contract } from 'ethers'
import { expect } from 'chai'

const zeroAddress = ethers.constants.AddressZero
const zeroBalance = ethers.BigNumber.from(0)

let accounts: Signer[],
  token: Contract

async function setupContract() {
  // get signers
  accounts = await ethers.getSigners()
  // deploy ERC721
  const Token = await ethers.getContractFactory('ERC721')
  token = await Token.deploy()
}

describe("ERC721", () => {
  before('setup ERC721 contract', setupContract)

  it('Should reject any ether send to it', async() => {
    const user = await accounts[1]
    await expect(user.sendTransaction({ to: token.address, value: 1 })).to.be.reverted
  })
})

describe("ERC721:Initialization", () => {
  before('setup ERC721 contract', setupContract)

  it('Should get balance zero of an account', async() => {
    const user1 = await accounts[2].getAddress()
    const balance = await token.balanceOf(user1)

    expect(balance).to.equal(zeroBalance)
  })

})
