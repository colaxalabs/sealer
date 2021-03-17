// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../registry/Registry.sol";
import "../lib/SafeMath.sol";
import "../token/ERC721.sol";
import "hardhat/console.sol";

contract PropertyUsage {

  using SafeMath for uint256;

  // @dev Emit Sealed after successful sealation
  event Sealed(
    string purpose,
    uint256 size,
    uint256 duration,
    uint256 cost,
    string titleNo,
    address owner,
    address tenant,
    uint256 tokenId
  );

  // @dev Emit Reclaimed after property rights reclamation
  event Reclaimed(
    uint256 tokenId,
    uint256 rights,
    bool fullFilled
  );

  // @dev Usage agreement
  struct Agreement {
    string purpose;
    uint256 size;
    uint256 duration;
    uint256 cost;
    address owner;
    address tenant;
    string titleNo;
    uint256 tokenId;
    bool fullFilled;
  }

  // @dev Property rights
  struct Rights {
    uint256 rights;
    bool claimed;
  }

  // ERC721 token contract
  ERC721 private token;
  // Registry contract
  Registry private registry;
  // Mapping user to latest agreement
  mapping(address => Agreement) private _agreements;
  // Mapping user to previous agreement
  mapping(address => uint256) private _userAgreements;
  mapping(address => mapping(uint256 => Agreement)) private _prevAgreements;
  // Mapping property to previous agreement
  mapping(uint256 => uint256) private _propertyPrevAgreements;
  mapping(uint256 => mapping(uint256 => Agreement)) private _propertyFullfilledAgreements;
  // Mapping property to its rights
  mapping(uint256 => Rights) private _rights;

  /**
   * @dev Init contract
   */
  constructor(address registryAddress, address tokenAddress) {
    // load Registry contract
    registry = Registry(registryAddress);
    // load ERC721 contract
    token = ERC721(tokenAddress);
  }

 /**
  * @notice Total previous property agreements
  * @dev Return total previous fullfiled agreements for a property
  * @param tokenId Tokenized property title
  * @return uint256
  */
  function propertyAgreements(uint256 tokenId) external view returns (uint256) {
    return _propertyPrevAgreements[tokenId];
  }

 /**
  * @notice Get property agreement
  * @dev Return property agreement at an index
  * @param tokenId Tokenized property title
  * @param index Index of the agreement
  * @return (string, uint256, uint256, uint256, address, address, string, bool)
  */
 function propertyAgreementAt(uint256 tokenId, uint256 index)
    external
    view
    returns (
      string memory,
      uint256,
      uint256,
      uint256,
      address,
      address,
      string memory,
      bool
    ) {
      require(index <= _propertyPrevAgreements[tokenId], 'REGISTRY: index out of range');
      Agreement storage _agreement = _propertyFullfilledAgreements[tokenId][index];
      return (
        _agreement.purpose,
        _agreement.size,
        _agreement.duration,
        _agreement.cost,
        _agreement.owner,
        _agreement.tenant,
        _agreement.titleNo,
        _agreement.fullFilled
      );
    }

  /**
   * @notice Total previous account agreements
   * @dev Get total previous agreements of an account
   * @param who Address
   * @return uint256
   */
  function userAgreements(address who) external view returns (uint256) {
    require(who != address(0), "REGISTRY: zero address");
    return _userAgreements[who];
  }

  /**
   * @notice Previous agreements of an account at an index
   * @dev Get account agreement at a certain index
   * @param who Address of an account
   * @param index Index in previous agreements mappings
   * @return (string, uint256, uint256, uint256, address, address, string, bool)
   */
  function userAgreementAt(address who, uint256 index)
    external
    view
    returns (
      string memory,
      uint256,
      uint256,
      uint256,
      address,
      address,
      string memory,
      bool
    ) {
      require(who != address(0), 'REGISTRY: zero address');
      require(index <= _userAgreements[who], 'REGISTRY: index out of range');
      Agreement storage _agreement = _prevAgreements[who][index];
      return (
        _agreement.purpose,
        _agreement.size,
        _agreement.duration,
        _agreement.cost,
        _agreement.owner,
        _agreement.tenant,
        _agreement.titleNo,
        _agreement.fullFilled
      );
    }

  /**
   * @notice Recreate message signed off-chain by property owner and tenant
   * @dev Return bytes32 of the agreement parameters signed off-chain
   * @param purpose Purpose
   * @param size Size of the land property
   * @param duration How long will the usage take?
   * @param cost Calculated cost after duration
   * @param tokenId Tokenized property title
   * @return bytes32
   */
  function recreateAgreementMessage(
    string memory purpose,
    uint256 size,
    uint256 duration,
    uint256 cost,
    uint256 tokenId
  ) internal pure returns (bytes32) {
    // hash agreement parameters
    bytes32 payloadHash = keccak256(abi.encode(purpose, size, duration, cost, tokenId));
    // replay eth_sign on-chain
    bytes32 message = prefixed(payloadHash);
    return message;
  }

  /**
   * @notice Recreate message signed off-chain by usage rights claimer
   * @dev Return bytes32 of the usage claim signed off-chain by claimer
   * @param title Title of the property
   * @param tokenId Tokenized property title
   * @return bytes32
   */
  function recreateClaimMessage(string memory title, uint256 tokenId) internal pure returns (bytes32) {
    // hash property title of the claim
    bytes32 payloadHash = keccak256(abi.encode(title, tokenId));
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
   * @notice Get property rights
   * @dev Returns available property rights
   * @param tokenId Tokenized property title
   * @return uint256
   */
  function getRights(uint256 tokenId) external view returns (uint256) {
    require(_rights[tokenId].claimed);
    return _rights[tokenId].rights;
  }

  /**
   * @notice Seal agreement signed off-chain
   * @dev Add property usage agreement signed by owner and tenant(s)
   * @param purpose Purpose
   * @param size Size of the property
   * @param duration How long with the usage last
   * @param cost Cost after duration overlaps
   * @param tokenId Tokenized property title
   * @param ownerSign Signature of property owner to verify ownership
   * @param tenantSign Signature to verify signer
   */
    function sealAgreement(
      string memory purpose,
      uint256 size,
      uint256 duration,
      uint256 cost,
      uint256 tokenId,
      bytes memory ownerSign,
      bytes memory tenantSign
    ) external {
      require(registry.titleSize(tokenId) != 0);
      require(size <= registry.titleSize(tokenId));
      require(duration > _agreements[msg.sender].duration && _agreements[msg.sender].cost == 0, 'latest running agreement');
      address owner = token.ownerOf(tokenId); // get owner of the tokenized title
      bytes32 message = recreateAgreementMessage(purpose, size, duration, cost, tokenId); // recreate message signed off-chain
      require(whoIsSigner(message, ownerSign) == owner, 'cannot authenticate owner');
      address tenant = whoIsSigner(message, tenantSign);
      require(tenant == msg.sender, 'cannot authenticate tenant');
      // Check if property rights have been claimed
      if (!_rights[tokenId].claimed) {
        _rights[tokenId] = Rights({
          rights: registry.titleSize(tokenId),
          claimed: true
        });
      }
      require(_rights[tokenId].rights != 0);
      _rights[tokenId].rights = _rights[tokenId].rights.sub(size);
      _agreements[tenant] = Agreement({
        purpose: purpose,
        size: size,
        duration: duration,
        cost: cost,
        owner: owner,
        tenant: tenant,
        titleNo: registry._idToTitle(tokenId),
        tokenId: tokenId,
        fullFilled: false
      });
      emit Sealed(
        purpose,
        size,
        duration,
        cost,
        registry._idToTitle(tokenId),
        _agreements[tenant].owner,
        _agreements[tenant].tenant,
        tokenId
      );
    }

  /**
   * @notice Claim usage rights to a property
   * @dev Return if an accounts(user) has a valid usage rights to an attested property
   * @param title Title of the property
   * @param tokenId Tokenized property title
   * @param signature Signature of the claimer
   * @return (bool, uint256)
   */
  function claimUsageRights(string memory title, uint256 tokenId, bytes memory signature) external view returns (bool, uint256, string memory) {
    //recreate claim message signed off-chain
    bytes32 message = recreateClaimMessage(title, tokenId);
    // get signer
    address claimer = whoIsSigner(message, signature);
    return (
      ((block.timestamp < _agreements[claimer].duration) &&
      (claimer == _agreements[claimer].tenant) &&
      _agreements[claimer].size != 0 &&
      recreateClaimMessage(_agreements[claimer].titleNo, _agreements[claimer].tokenId) == message &&
      !_agreements[claimer].fullFilled), _agreements[claimer].duration, _agreements[claimer].titleNo);
  }

  /**
   * @notice Reclaim property rights and cost after agreement duration has elapsed
   * @dev Reclaim property rights and transfer fund held in escrow to property owner
   * @param purpose What was the agreement purpose
   * @param size Requested size?
   * @param duration How long was the agreement to last?
   * @param cost How much did the agreement cost?
   * @param tokenId Tokenized property title
   * @param claimerSign Signature of the claimer(property owner)
   * @param tenantSign Signature of the tenant
   */
  function reclaimRights(
    string memory purpose,
    uint256 size,
    uint256 duration,
    uint256 cost,
    uint256 tokenId,
    bytes memory claimerSign,
    bytes memory tenantSign
  ) external {
    // recreate claim message signed off-chain
    bytes32 message = recreateAgreementMessage(purpose, size, duration, cost, tokenId);
    // get claimer
    address claimer = whoIsSigner(message, claimerSign);
    // get tenant
    address tenant = whoIsSigner(message, tenantSign);
    // get agreement
    Agreement storage agreement = _agreements[tenant];
    require(agreement.tenant == tenant, 'cannot authenticate tenant in agreement');
    require(agreement.owner == claimer, 'cannot authenticate property owner in agreement');
    require(claimer == msg.sender, 'cannot authenticate claimer');
    require(agreement.duration < block.timestamp, 'agreement timeline not fullfiled');
    // reclaim rights from agreement back to property owner
    _rights[tokenId].rights = _rights[tokenId].rights.add(agreement.size);
    _agreements[tenant].size = 0;
    _agreements[tenant].fullFilled = true;
    // Account user fullfiled agreements
    _userAgreements[tenant] += 1;
    _prevAgreements[tenant][_userAgreements[tenant]] = agreement;
    // Account property fullfilled agreements
    _propertyPrevAgreements[tokenId] += 1;
    _propertyFullfilledAgreements[tokenId][_propertyPrevAgreements[tokenId]] = agreement;
    emit Reclaimed(tokenId, _rights[tokenId].rights, _agreements[tenant].fullFilled);
  }
}
