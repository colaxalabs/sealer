// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ERC721.sol";

contract Registry {
  // NFT contract(tokenized farms)
  ERC721 private nftContract;
  // @dev Total number of tokenized farms
  uint256 private _totalFarms;

  /**
   * @dev Init contract
   */
  constructor(address nftAddress) {
    // load nft contract
    nftContract = ERC721(nftAddress);
  }

  /**
   * @notice Total farms in the registry
   * @dev Return total tokenized farms
   * @return uint256
   */
  function totalFarms() external view returns (uint256) {
    return _totalFarms;
  }

  /**
   * @notice Total farms by user/account
   * @dev Return number of tokenized farms by user
   * @return uint256
   */
  function farmCount(address who) external view returns (uint256) {
    return nftContract.balanceOf(who);
  }
}
