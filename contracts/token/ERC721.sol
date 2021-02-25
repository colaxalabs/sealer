// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IERC721.sol";
import "../interfaces/IERC721Receiver.sol";
import "../introspection/ERC165.sol";
import "../utils/Address.sol";

contract ERC721 is ERC165, IERC721 {
  using Address for address;
  // Mapping holders to their indexed tokens
  mapping(address => mapping(uint256 => uint256)) private _holderToken;
  // Mapping holders to number of tokens held
  mapping(address => uint256) private _balances;
  // Mapping token to their holder
  mapping(uint256 => address) private _tokenToHolder;

  /**
   * @dev Initalizes the contract by registering supported interfaces
   */
  constructor() {
    // _register supported interfaces to conform to ERC721 via ERC165
    _registerInterface(type(IERC721).interfaceId);
  }

  /**
   * @dev See {IERC721-balanceOf}
   */
  function balanceOf(address who) external view override returns (uint256) {
    require(who != address(0), "ERC721: balance query for zero address");
    return _balances[who];
  }

  /**
   * @dev See {IERC721-ownerOf}
   */
  function ownerOf(uint256 tokenId) external view override returns (address) {
    require(_exists(tokenId), "ERC721: nonexistent token");
    return _tokenToHolder[tokenId];
  }

  /**
   * @dev Return token at the specified holder index
   */
  function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256) {
    require(owner != address(0), "ERC721:owner cannot be zero address");
    require(_balances[owner] > 0, "ERC721: cannot query zero token");
    require(index <= _balances[owner], "ERC721: index out of range");
    return _holderToken[owner][index];
  }

  /**
   * @dev See {IERC721-approve}
   */
  function approve(address to, uint256 tokenId) external override {}

  /**
   * @dev See {IERC721-getApproved}
   */
  function getApproved(uint256 tokenId) external view override returns (address) {}

  /**
   * @dev See {IERC721-setApprovalForAll}
   */
  function setApprovalForAll(address operator, bool approved) external override {}

  /**
   * @dev See {IERC721-isApprovedForAll}
   */
  function isApprovedForAll(address owner, address operator) external view override returns (bool) {}

  /**
   * @dev See {IERC721-transferFrom}
   */
  function transferFrom(address from, address to, uint256 tokenId) external override {}

  /**
   * @dev See {IERC721-safeTransferFrom}
   */
  function safeTransferFrom(address from, address to, uint256 tokenId) external override {}

  /**
   * @dev See {IERC721-safeTransferFrom}
   */
  function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) external override {}

  /**
   * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
   * are aware of the ERC721 protocol to prevent tokens from being forever locked.
   *
   * `_data` is additional data, it has no specified format and it is sent in call to `to`.
   *
   * This internal function is equivalent to {safeTransferFrom}, and can be used to e.g.
   * implement alternative mechanisms to perform token transfer, such as signature-based.
   *
   * Requirements:
   *
   * - `from` cannot be the zero address.
   * - `to` cannot be the zero address.
   * - `tokenId` token must exist and be owned by `from`.
   * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
   *
   * emits a {Transfer} event.
   */
  function _safeTransfer(address from, address to, uint256 tokenId, bytes memory _data) internal {}

  /**
   * @dev Returns whether `tokenId` exists.
   *
   * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
   *
   * Tokens start existing when they are minted (`_mint`),
   */
  function _exists(uint256 tokenId) internal view returns (bool) {
    return _tokenToHolder[tokenId] != address(0);
  }

  /**
   * @dev Returns whether `spender` is allowed to manage `tokenId`.
   *
   * Requirements:
   *
   * - `tokenId` must exist.
   */
  function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {}

  /**
   * @dev Safely mints `tokenId` and transfers it to `to`.
   *
   * Requirements:
   *
   * - `tokenId` must not exist.
   * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
   *
   * emits a {Transfer} event.
   */
  function _safeMint(address to, uint256 tokenId) public {
    _safeMint(to, tokenId, "");
  }

  /**
   * @dev Same as {xref-ERC721-_safeMint-address-uint256-}[`_safeMint`], with an additional `data` parameter which is
   * forwarded in {IERC721Receiver-onERC721Received} to contract recipients.
   */
  function _safeMint(address to, uint256 tokenId, bytes memory _data) internal {
    _mint(to, tokenId);
    require(_checkOnERC721Received(address(0), to, tokenId, _data), "ERC721: transfer to non ERC721Receiver implementer");
  }

  /**
   * @dev Mints `tokenId` and transfers it to `to`.
   *
   * WARNING: Usage of this method is discouraged, use {_safeMint} whenever possible
   *
   * Requirements:
   *
   * - `tokenId` must not exist.
   * - `to` cannot be the zero address.
   *
   * emits a {Transfer} event.
   */
  function _mint(address to, uint256 tokenId) internal {
    require(to != address(0), "ERC721: cannot mint to zero address");
    require(!_exists(tokenId), "ERC721: token already minted");
    _beforeTokenTransfer(address(0), to, tokenId);
    // Count tokens for holder
    _balances[to] = _balances[to] + 1;
    // Index tokenId to owner token holder
    _holderToken[to][_balances[to]] = tokenId;
    // Map tokenId to owner
    _tokenToHolder[tokenId] = to;
  }

  /**
   * @dev Transfers `tokenId` from `from` to `to`.
   *  As opposed to {transferFrom}, this imposes no restrictions on msg.sender.
   *
   * Requirements:
   *
   * - `to` cannot be the zero address.
   * - `tokenId` token must be owned by `from`.
   *
   * emits a {Transfer} event.
   */
  function _transfer(address from, address to, uint256 tokenId) internal {}

  /**
   * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
   * The call is not executed if the target address is not a contract.
   *
   * @param from address representing the previous owner of the given token ID
   * @param to target address that will receive the tokens
   * @param tokenId uint256 ID of the token to be transferred
   * @param _data bytes optional data to send along with the call
   * @return bool whether the call correctly returned the expected magic value
   */
  function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory _data) private returns (bool) {
    if (to.isContract()) {
      try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, _data) returns (bytes4 retval) {
        return retval == IERC721Receiver(to).onERC721Received.selector;
      } catch (bytes memory reason) {
        if (reason.length == 0) {
          revert("ERC721: transfer to non ERC721Receiver implementer");
        } else {
          assembly {
            revert(add(32, reason), mload(reason))
          }
        }
      }
    } else {
      return true;
    }
  }

  function _approve(address to, uint256 tokenId) private {}

  /**
   * @dev Hook that is called before any token transfer. This includes minting
   * and burning.
   *
   * Calling conditions:
   *
   * - When `from` and `to` are both non-zero, ``from``'s `tokenId` will be
   * transferred to `to`.
   * - When `from` is zero, `tokenId` will be minted for `to`.
   * - When `to` is zero, ``from``'s `tokenId` will be burned.
   * - `from` cannot be the zero address.
   * - `to` cannot be the zero address.
   *
   * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
   */
  function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal {}
}
