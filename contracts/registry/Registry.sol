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

  // @dev Emit Sealed after successful sealation
  event Sealed(
    string purpose,
    uint256 size,
    uint256 duration,
    uint256 cost,
    string titleNo,
    bytes ownerSign,
    bytes tenantSign,
    uint256 tokenId
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

  // @dev Usage agreement
  struct Agreement {
    string purpose;
    uint256 size;
    uint256 duration;
    uint256 cost;
    bytes ownerSignature;
    bytes tenantSignature;
    string titleNo;
  }

  // NFT contract(tokenized lands)
  ERC721 private nftContract;
  // @dev Total number of tokenized lands
  uint256 private _totalLands;
  // Mapping titleNo/regNo to tokenId
  mapping(string => uint256) private _registryToId;
  // Mapping used title documents
  mapping(bytes32 => bool) private _nonce;
  // Mapping title to land
  mapping(string => Land) private _titleLand;
  // Mapping user to latest agreement
  mapping(address => Agreement) private _agreements;
  // Mapping user to previous agreement
  mapping(address => uint256) private _totalPrevAgreements;
  mapping(address => mapping(uint256 => Agreement)) private _prevAgreements;

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
    bytes32 message = recreateAttestationMessage(tokenId, title, documentHash, size, unit);
    // Authenticate message
    require(whoIsSigner(message, attestor) == msg.sender, "REGISTRY: cannot authenticate signer");
    // Recover signer of the message
    address signer = whoIsSigner(message, attestor);
    // Mint tokenId
    nftContract._safeMint(signer, tokenId);
    _registryToId[title] = tokenId; // reference title to minted tokenID
    _totalLands += 1;
    // Store land structure
    _titleLand[title] = Land({
      tokenId: tokenId,
      title: title,
      titleDocument: documentHash,
      size: size,
      unit: unit,
      attestor: signer
    });
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
   * @param title Title of the land(use to recreate message signed off-chain on-chain)
   * @param signature Signature of the claimer
   * return bool
   */
  function claimOwnership(string memory title, bytes memory signature) external view returns (bool) {
    require(_registryToId[title] != 0, "REGISTRY: nonexistent title");
    bytes32 payloadHash = keccak256(abi.encode(title));
    bytes32 message = prefixed(payloadHash);
    require(whoIsSigner(message, signature) == msg.sender, 'cannot authenticate claimer');
    // get property details
    Land storage _land = _titleLand[title];
    return (whoIsSigner(message, signature) == _land.attestor) && (payloadHash == keccak256(abi.encode(_land.title)));
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
   * @notice Recreate message signed off-chain by property owner and tenant
   * @dev Return bytes32 of the agreement parameters signed off-chain
   * @param purpose Purpose
   * @param size Size of the land property
   * @param duration How long will the usage take?
   * @param cost Calculated cost after duration
   * @return bytes32
   */
  function recreateAgreementMessage(
    string memory purpose,
    uint256 size,
    uint256 duration,
    uint256 cost,
    string memory titleNo
  ) internal pure returns (bytes32) {
    // hash agreement parameters
    bytes32 payloadHash = keccak256(abi.encode(purpose, size, duration, cost, titleNo));
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

  /**
   * @notice Total previous account agreements
   * @dev Get total previous agreements of an account
   * @param who Address
   * @return uint256
   */
  function totalPrevAgreements(address who) external view returns (uint256) {
    require(who != address(0), "REGISTRY: zero address");
    return _totalPrevAgreements[who];
  }

  /**
   * @notice Previous agreements of an account at an index
   * @dev Get account agreement at a certain index
   * @param who Address of an account
   * @param index Index in previous agreements mappings
   * @return (string, uint256, uint256, uint256, bytes, bytes, string)
   */
  function agreementAt(address who, uint256 index)
    external
    view
    returns (string memory, uint256, uint256, uint256, bytes memory, bytes memory, string memory) {
      require(who != address(0), 'REGISTRY: zero address');
      require(index <= _totalPrevAgreements[who], 'REGISTRY: index out of range');
      Agreement storage _agreement = _prevAgreements[who][index];
      return (
        _agreement.purpose,
        _agreement.size,
        _agreement.duration,
        _agreement.cost,
        _agreement.ownerSignature,
        _agreement.tenantSignature,
        _agreement.titleNo
      );
    }

  /**
   * @notice Seal agreement signed off-chain
   * @dev Add property usage agreement signed by owner and tenant(s)
   * @param purpose Purpose
   * @param size Size of the property
   * @param duration How long with the usage last
   * @param cost Cost after duration overlaps
   * @param titleNo Title of the property
   * @param ownerSign Signature of property owner to verify ownership
   * @param tenantSign Signature to verify signer
   */
    function sealAgreement(
      string memory purpose,
      uint256 size,
      uint256 duration,
      uint256 cost,
      string memory titleNo,
      bytes memory ownerSign,
      bytes memory tenantSign
    ) external {
      require(_registryToId[titleNo] != 0);
      require(size <= _titleLand[titleNo].size);
      require(duration > _agreements[msg.sender].duration && _agreements[msg.sender].cost == 0, 'latest running agreement');
      address owner = nftContract.ownerOf(_registryToId[titleNo]); // get owner of the tokenized title
      bytes32 message = recreateAgreementMessage(purpose, size, duration, cost, titleNo); // recreate message signed off-chain
      require(whoIsSigner(message, ownerSign) == owner, 'invalid owner signature');
      require(whoIsSigner(message, tenantSign) == msg.sender, 'cannot authenticate tenant');
      _agreements[msg.sender] = Agreement({
        purpose: purpose,
        size: size,
        duration: duration,
        cost: cost,
        ownerSignature: ownerSign,
        tenantSignature: tenantSign,
        titleNo: titleNo
      });
      Agreement storage seal = _agreements[msg.sender];
      emit Sealed(
        seal.purpose,
        seal.size,
        seal.duration,
        seal.cost,
        seal.titleNo,
        seal.ownerSignature,
        seal.tenantSignature,
        _registryToId[titleNo]
      );
    }
}
