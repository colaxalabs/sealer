// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./registry/Registry.sol";
import "./token/ERC721.sol";
import "hardhat/console.sol";

contract PropertyUsage {
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

  // @dev Usage agreement
  struct Agreement {
    string purpose;
    uint256 size;
    uint256 duration;
    uint256 cost;
    address owner;
    address tenant;
    string titleNo;
  }

  // ERC721 token contract
  ERC721 private token;
  // Registry contract
  Registry private registry;
  // Mapping user to latest agreement
  mapping(address => Agreement) private _agreements;
  // Mapping user to previous agreement
  mapping(address => uint256) private _totalPrevAgreements;
  mapping(address => mapping(uint256 => Agreement)) private _prevAgreements;

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
   * @notice Recreate message signed off-chain by usage rights claimer
   * @dev Return bytes32 of the usage claim signed off-chain by claimer
   * @param title Title of the property
   * @return bytes32
   */
  function recreateClaimMessage(string memory title) internal pure returns (bytes32) {
    // hash property title of the claim
    bytes32 payloadHash = keccak256(abi.encode(title));
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
   * @return (string, uint256, uint256, uint256, address, address, string)
   */
  function agreementAt(address who, uint256 index)
    external
    view
    returns (string memory, uint256, uint256, uint256, address, address, string memory) {
      require(who != address(0), 'REGISTRY: zero address');
      require(index <= _totalPrevAgreements[who], 'REGISTRY: index out of range');
      Agreement storage _agreement = _prevAgreements[who][index];
      return (
        _agreement.purpose,
        _agreement.size,
        _agreement.duration,
        _agreement.cost,
        _agreement.owner,
        _agreement.tenant,
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
      require(registry._registryToId(titleNo) != 0);
      require(size <= registry.titleSize(titleNo));
      require(duration > _agreements[msg.sender].duration && _agreements[msg.sender].cost == 0, 'latest running agreement');
      address owner = token.ownerOf(registry._registryToId(titleNo)); // get owner of the tokenized title
      bytes32 message = recreateAgreementMessage(purpose, size, duration, cost, titleNo); // recreate message signed off-chain
      require(whoIsSigner(message, ownerSign) == owner, 'invalid owner signature');
      address tenant = whoIsSigner(message, tenantSign);
      require(tenant == msg.sender, 'cannot authenticate tenant');
      _agreements[msg.sender] = Agreement({
        purpose: purpose,
        size: size,
        duration: duration,
        cost: cost,
        owner: owner,
        tenant: tenant,
        titleNo: titleNo
      });
      emit Sealed(
        purpose,
        size,
        duration,
        cost,
        titleNo,
        _agreements[msg.sender].owner,
        _agreements[msg.sender].tenant,
        registry._registryToId(titleNo)
      );
    }

  /**
   * @notice Claim usage rights to a property
   * @dev Return if an accounts(user) has a valid usage rights to an attested property
   * @param title Title of the property
   * @param signature Signature of the claimer
   * @return (bool, uint256)
   */
  function claimUsageRights(string memory title, bytes memory signature) external view returns (bool, uint256, string memory) {
    require(registry._registryToId(title) != 0);
    //recreate claim message signed off-chain
    bytes32 message = recreateClaimMessage(title);
    // get signer
    address claimer = whoIsSigner(message, signature);
    return (
      ((block.timestamp < _agreements[claimer].duration) &&
      (claimer == _agreements[claimer].tenant) &&
      recreateClaimMessage(_agreements[claimer].titleNo) == message), _agreements[claimer].duration, _agreements[claimer].titleNo);
  }
}
