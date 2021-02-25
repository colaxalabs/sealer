// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ERC721.sol";
import "hardhat/console.sol";

contract Registry {
  // @dev Emit Attestation after successful registration
  event Attestation(
    string _title,
    string _documentHash,
    uint256 _size,
    string _unit,
    address _signer
  );

  // @dev Land structure
  struct Land {
    string title;
    string titleDocument;
    uint256 size;
    string unit;
    address attestor;
  }

  // NFT contract(tokenized lands)
  ERC721 private nftContract;
  // @dev Total number of tokenized lands
  uint256 private _totalFarms;
  // Mapping titleNo/regNo to tokenId
  mapping(string => uint256) private _registryToId;
  // Mapping used title documents
  mapping(bytes32 => bool) private _nonce;
  // Mapping title to land
  mapping(string => Land) private _titleLand;

  /**
   * @dev Init contract
   */
  constructor(address nftAddress) {
    // load nft contract
    nftContract = ERC721(nftAddress);
  }

  /**
   * @notice Total lands in the registry
   * @dev Return total tokenized lands
   * @return uint256
   */
  function totalFarms() external view returns (uint256) {
    return _totalFarms;
  }

  /**
   * @notice Total lands by user/account
   * @dev Return number of tokenized lands by user
   * @return uint256
   */
  function landCount(address who) external view returns (uint256) {
    return nftContract.balanceOf(who);
  }

  /**
   * @notice Add farm to the registry
   * @dev Attest ownership to a piece of land and append to registry
   * @param title Title of the land
   * @param documentHash Hash of the title document
   * @param size Size of the land(should match with data in title document)
   * @param unit Measurement unit of size
   * @param attestor Attestor signature
   */
  function attestProperty(uint256 tokenId, string memory title, string memory documentHash, uint256 size, string memory unit, bytes memory attestor) external {
    require(!_nonce[keccak256(abi.encode(documentHash))], "REGISTRY: duplicate title document");
    _nonce[keccak256(abi.encode(documentHash))] = true;

    // Recreate message signed off-chain by signer
    bytes32 message = prefixed(keccak256(abi.encode(tokenId, title, documentHash, size, unit)));
    // Authenticate message
    //require(whoIsSigner(message, attestor) == msg.sender, "REGISTRY: cannot authenticate signer");
    // Recover signer of the message
    address signer = whoIsSigner(message, attestor);
    // Mint tokenId
    nftContract._safeMint(signer, tokenId);
    // Store land structure
    _titleLand[title] = Land({
      title: title,
      titleDocument: documentHash,
      size: size * 10 ** 18,
      unit: unit,
      attestor: signer
    });
    emit Attestation(
      title,
      documentHash,
      size * 10 ** 18,
      unit,
      signer
    );
  }

  /**
   * @notice Claim ownership to land title
   * @dev Get owner of the land title
   * @param title Title of the land(use to recreate message signed off-chain on-chain)
   * @param signature Signature of the claimer
   */
  function claimOwnership(string memory title, bytes memory signature) external {}

  /**
   * @notice Build off-chain signed message hash
   * @dev Return prefixed hash to mimic eth_sign behavior
   */
  function prefixed(bytes32 hash) internal pure returns (bytes32) {
    return keccak256(abi.encode("\x19Ethereum Signed Message:\n32", hash));
  }

  /**
   * @notice Split signer signature
   */
  function splitSignature(bytes memory sig) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
    require(sig.length == 65, "REGISTRY: invalid signature to split");
    // Split signature
    assembly {
      // first 32 bytes, after the length prefix
      r := mload(add(sig, 32))
      // second 32 bytes
      s := mload(add(sig, 64))
      // final byte (first byte of the next 32 bytes)
      v := byte(0, mload(add(sig, 96)))
    }
    return (v, r, s);
  }

  /**
   * @notice Recover signer from message
   * @dev Recover signer from signature
   * @param message Message signed by signer
   * @param sig Signature of the signer
   */
  function whoIsSigner(bytes32 message, bytes memory sig) internal pure returns (address) {
    (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);

    return ecrecover(message, v, r, s);
  }
}
