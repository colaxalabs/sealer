// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev Interface of ERC165 standard as defined in
 * https://eips.ethereum.org/EIPS/eip-165/[EIP].
 *
 * Implementers can declare support of contract interfaces
 * which can then be queried by others ({ERC165Checkers})
 */

interface IERC165 {
  /**
   * @dev Returns `true` if the contract implements the interface
   * defined by `interfaceId`
   *
   * Learn more https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
   * 
   * This function call must use less than 30 000 gas
   */
  function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
