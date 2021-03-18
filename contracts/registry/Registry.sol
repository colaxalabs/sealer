// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ERC721.sol";
import "hardhat/console.sol";

contract Registry {

  // @dev Emit Attestation after successful registration
  event Attestation(
    uint256 _tokenId,
    string _title,
    string _documentHash,
    uint256 _size,
    string _unit,
    address indexed _signer
  );

  // @dev Land structure
  struct Land {
    uint256 tokenId;
    string title;
    string titleDocument;
    uint256 size;
    string unit;
    address attestor;
  }

  // NFT contract(tokenized lands)
  ERC721 private nftContract;
  // @dev Total number of tokenized lands
  uint256 private _totalLands;
  // Mapping titleNo/regNo to tokenId
  mapping(uint256 => string) public _idToTitle;
  // Mapping used title documents
  mapping(bytes32 => bool) private _nonce;
  // Mapping tokenized title to land
  mapping(uint256 => Land) private _titleLand;
  // Mapping account to its properties(ownership) user -> index -> property
  mapping(address => mapping(uint256 => Land)) private _accountProperties;

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
  function totalLands() external view returns (uint256) {
    return _totalLands;
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
   * @notice Size of an attested property
   * @dev Return the size of a land
   * @param tokenId Tokenized property title
   * @return uint256
   */
  function titleSize(uint256 tokenId) external view returns (uint256) {
    return _titleLand[tokenId].size;
  }

  /**
    * @notice Get account property
    * @dev Return account property at an index
    * @param who Account address
    * @param index Index of the property
    * @return (uint256, string memory, string memory, uint256, string memory, address)
    */
   function accountProperty(
           address who,
           uint256 index
   ) external view returns (uint256, string memory, string memory, uint256, string memory, address) {
           require(who != address(0));
           require(index <= nftContract.balanceOf(who), "index out of range");
           Land storage _land = _accountProperties[who][index];
           return (
                   _land.tokenId,
                   _land.title,
                   _land.titleDocument,
                   _land.size,
                   _land.unit,
                   _land.attestor
           );
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
  function attestProperty(
          uint256 tokenId,
          string memory title,
          string memory documentHash,
          uint256 size,
          string memory unit,
          bytes memory attestor
  ) external {
    require(!_nonce[keccak256(abi.encode(documentHash))], "REGISTRY: duplicate title document");
    _nonce[keccak256(abi.encode(documentHash))] = true;

    // Recreate message signed off-chain by signer
    bytes32 message = recreateAttestationMessage(tokenId, title, documentHash, size, unit);
    // Authenticate message
    require(whoIsSigner(message, attestor) == msg.sender, "REGISTRY: cannot authenticate signer");
    // Recover signer of the message
    address signer = whoIsSigner(message, attestor);
    // Mint tokenId
    nftContract._safeMint(signer, tokenId);
    _idToTitle[tokenId] = title; // reference title to minted tokenID
    _totalLands += 1;
    // Store land structure
    _titleLand[tokenId] = Land({
      tokenId: tokenId,
      title: title,
      titleDocument: documentHash,
      size: size,
      unit: unit,
      attestor: signer
    });
    // Record property to user attestor
    _accountProperties[signer][nftContract.balanceOf(signer)] = _titleLand[tokenId];
    emit Attestation(
      tokenId,
      title,
      documentHash,
      size,
      unit,
      signer
    );
  }

  /**
   * @notice Claim ownership to land title
   * @dev Check if signer is the owner of the property in title
   * @param title Title of the land
   * @param tokenId Tokenized property title
   * @param signature Signature of the claimer
   * return bool
   */
  function claimOwnership(string memory title, uint256 tokenId, bytes memory signature) external view returns (bool) {
    // recreate message signed off-chain by claimer
    bytes32 payloadHash = keccak256(abi.encode(title, tokenId));
    bytes32 message = prefixed(payloadHash);
    // authenticate claimer
    require(whoIsSigner(message, signature) == msg.sender, 'cannot authenticate claimer');
    // get property details
    Land storage _land = _titleLand[tokenId];
    return (whoIsSigner(message, signature) == _land.attestor);
  }

  /**
   * @notice Recreate message signed off-chain by property owner
   * @dev Return bytes32 of the land title data parameters signed off-chain
   * @param tokenId To-be-Tokenized property ID
   * @param title Land title
   * @param documentHash Document hash of the land title
   * @param size Size of the land
   * @param unit Size unit of the land
   * @return bytes32
   */
  function recreateAttestationMessage(uint256 tokenId, string memory title, string memory documentHash, uint256 size, string memory unit) internal pure returns (bytes32) {
    // hash message parameters
    bytes32 payloadHash = keccak256(abi.encode(tokenId, title, documentHash, size, unit));
    // replay eth_sign on-chain
    bytes32 message = prefixed(payloadHash);
    return message;
  }

  /**
   * @notice Prefix message sign with 'Ethereum Signed Message'
   * @dev Replays eth_sign mechanism
   */
  function prefixed(bytes32 hash) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
  }

  /**
   * @notice Split signer from signature
   */
  function whoIsSigner(bytes32 message, bytes memory sig) internal pure returns (address) {
    bytes32 r;
    bytes32 s;
    uint8 v;
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

    if (v < 27) {
      v += 27;
    }

    if (v != 27 && v != 28) {
      return address(0);
    } else {
      return ecrecover(message, v, r, s);
    }

  }
}
