// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IERC165.sol";

/**
 * @dev Implements {ERC165} interface
 *
 *
 * Contract may inherit from this and call {_registerInterface}
 * to declare their support for an interface
 */
abstract contract ERC165 is IERC165 {
  /**
   * @dev Mapping of interface `ids` to whether or not its supported
   *
   */
  mapping(bytes4 => bool) private _supportedInterfaces;

  constructor() {
    // Derived contracts need only to register support of their own
    // interfaces
    // We register support for IERC165 itself here
    _registerInterface(type(IERC165).interfaceId);
  }

  /**
   * @dev See {IERC165=supportsInterface}
   *
   * Always use less than 30 000 gas
   */
  function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return _supportedInterfaces[interfaceId];
  }

  /**
   * @dev Register the contract as an implementer of the interface
   * defined by `interfaceId`
   *
   * Requirements: -`interfaceId` cannot be the ERC165 invalid interface (`0xffffffff`)
   * as is automatically registered in ERC165
   */
  function _registerInterface(bytes4 interfaceId) internal virtual {
    require(interfaceId != 0xffffffff, "ERC165: invalid interface id");
    _supportedInterfaces[interfaceId] = true;
  }
}
