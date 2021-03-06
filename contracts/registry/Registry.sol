// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "../token/ERC721.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";

contract Registry is BaseRelayRecipient {

    using SafeMath for uint256;

  // @dev Emit Attestation after successful registration
  event Attestation(
    uint256 _tokenId,
    string _documentHash,
    uint256 _size,
    address indexed _signer
  );

  // @dev Land structure
  struct Land {
    uint256 tokenId;
    string titleDocument;
    uint256 size;
    address attestor;
  }

  // NFT contract(tokenized lands)
  ERC721 private nftContract;
  // @dev Total number of tokenized lands
  uint256 private _totalLands;
  // Mapping used title documents
  mapping(bytes32 => bool) private _nonce;
  // Mapping tokenized title to land
  mapping(uint256 => Land) private _titleLand;
  // Mapping account to its properties(ownership) user -> index -> property
  mapping(address => mapping(uint256 => Land)) private _accountProperties;
  // Accumulated rights
  mapping(address => uint256) private _accumulatedRights; // for an account
  uint256 private _totalAccumulatedRights; // all accumulated rights

  /**
   * @dev Init contract
   */
  constructor(address nftAddress, address _forwarder) public {
    // load nft contract
    trustedForwarder = _forwarder;
    nftContract = ERC721(nftAddress);
  }

  function versionRecipient() external override view returns (string memory) {
      return "1.0.1";
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
  * @notice Get property
  * @dev Return property details
  * @param tokenId Tokenized property id
  * @return (uint256, string memory, uint256, address)
  */
  function getProperty(uint256 tokenId) external view returns (uint256, string memory, uint256, address) {
          Land storage _land = _titleLand[tokenId];
          return (
                  _land.tokenId,
                  _land.titleDocument,
                  _land.size,
                  _land.attestor
          );
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
    * @notice Account accumulated rights
    * @dev Return total accumulated rights for an account
    * @param who Account address
    * @return uint256
    */
  function accumulatedRights(address who) external view returns (uint256) {
      require(who != address(0));
      return _accumulatedRights[who];
  }

  /**
    * @notice Accumulated rights
    * @dev Return all accumulated rights
    * @return uint256
    */
  function allAccumulatedRights() external view returns (uint256) {
      return _totalAccumulatedRights;
  }

  /**
    * @notice Get account property
    * @dev Return account property at an index
    * @param who Account address
    * @param index Index of the property
    * @return (uint256, string memory, uint256, address)
    */
   function accountProperty(
           address who,
           uint256 index
   ) external view returns (uint256, string memory, uint256, address) {
           require(who != address(0));
           require(index <= nftContract.balanceOf(who), "index out of range");
           Land storage _land = _accountProperties[who][index];
           return (
                   _land.tokenId,
                   _land.titleDocument,
                   _land.size,
                   _land.attestor
           );
   }

  /**
   * @notice Add farm to the registry
   * @dev Attest ownership to a piece of land and append to registry
   * @param tokenId Tokenized property title
   * @param documentHash Hash of the title document
   * @param size Size of the land(should match with data in title document)
   * @param v Parity of the y-co-ordinate of r
   * @param r The x co-ordinate of r
   * @param s The s value of the signature
   * @param attestor Attestor signature
   */
  function attestProperty(
          uint256 tokenId,
          string calldata documentHash,
          uint256 size,
          bytes calldata attestor,
          uint8 v,
          bytes32 r,
          bytes32 s
  ) external {
    require(!_nonce[keccak256(abi.encode(documentHash))], "REGISTRY: duplicate title document");
    _nonce[keccak256(abi.encode(documentHash))] = true;

    // Recreate message signed off-chain by signer
    bytes32 message = recreateAttestationMessage(tokenId, documentHash, size);
    // Authenticate message
    require(whoIsSigner(message, attestor, v, r, s) == _msgSender(), "REGISTRY: cannot authenticate signer");
    // Recover signer of the message
    address signer = whoIsSigner(message, attestor, v, r, s);
    // Mint tokenId
    nftContract._safeMint(signer, tokenId);
    _totalLands += 1;
    // Store land structure
    _titleLand[tokenId] = Land({
      tokenId: tokenId,
      titleDocument: documentHash,
      size: size,
      attestor: signer
    });
    // Account accumulated rights
    _accumulatedRights[signer] = _accumulatedRights[signer].add(size);
    _totalAccumulatedRights = _totalAccumulatedRights.add(size);
    // Record property to user attestor
    _accountProperties[signer][nftContract.balanceOf(signer)] = _titleLand[tokenId];
    emit Attestation(
      tokenId,
      documentHash,
      size,
      signer
    );
  }

  /**
   * @notice Claim ownership to land title
   * @dev Check if signer is the owner of the property in title
   * @param tokenId Tokenized property title
   * @param docHash Property title document hash
   * @param size Property approximation area
   * @param signature Signature of the claimer
   * @param v Parity of the y-co-ordinate of r
   * @param r The x co-ordinate of r
   * @param s The s value of the signature
   * return bool
   */
  function claimOwnership(
          uint256 tokenId,
          string calldata docHash,
          uint256 size,
          bytes calldata signature,
          uint8 v,
          bytes32 r,
          bytes32 s
  ) external view returns (bool) {
    // recreate message signed off-chain by claimer
    bytes32 message = recreateAttestationMessage(tokenId, docHash, size);
    // authenticate claimer
    require(whoIsSigner(message, signature, v, r, s) == _msgSender(), 'cannot authenticate claimer');
    // get property details
    Land storage _land = _titleLand[tokenId];
    return (whoIsSigner(message, signature, v, r, s) == _land.attestor);
  }

  /**
   * @notice Recreate message signed off-chain by property owner
   * @dev Return bytes32 of the land title data parameters signed off-chain
   * @param tokenId To-be-Tokenized property ID
   * @param documentHash Document hash of the land title
   * @param size Size of the land
   * @return bytes32
   */
  function recreateAttestationMessage(uint256 tokenId, string memory documentHash, uint256 size) internal pure returns (bytes32) {
    // hash message parameters
    bytes32 payloadHash = keccak256(abi.encode(tokenId, documentHash, size));
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
   * @param message Hash of the message signed off-chain
   * @param sig Signature from the above signed message
   * @param v Parity of the y-co-ordinate of r
   * @param r The x co-ordinate of r
   * @param s The s value of the signature
   */
  function whoIsSigner(bytes32 message, bytes memory sig, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) {
    require(sig.length == 65, "REGISTRY: invalid signature to split");
    return ecrecover(message, v, r, s);
  }
}
