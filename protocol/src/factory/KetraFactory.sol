// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {KetraAccount} from "../account/KetraAccount.sol";
import {T1Guard} from "../account/T1Guard.sol";
import {RawCode} from "../lib/RawCode.sol";

/// @title KetraFactory
/// @notice Deploys prepared ML-DSA public-key blobs and the Ketra accounts bound to them.
///         Both addresses are CREATE2, so a user can know the account address before either exists.
contract KetraFactory {
    uint256 public constant PK_BLOB_BYTES = 20545;

    address public immutable verifier;
    address public immutable feeRecipient;

    error BadBlob();
    error DegenerateKey();
    error ZeroAddress();
    error FeeRecipientIsPayer();

    event KeyDeployed(address indexed pkBlob, bytes32 salt);
    event AccountCreated(address indexed account, address indexed pkBlob, bytes32 salt);

    constructor(address verifier_, address feeRecipient_) {
        if (verifier_.code.length == 0 || feeRecipient_ == address(0)) revert ZeroAddress();
        if (feeRecipient_ == msg.sender) revert FeeRecipientIsPayer();
        verifier = verifier_;
        feeRecipient = feeRecipient_;
    }

    /// @notice Address the prepared public-key bytecode will occupy for this salt.
    function predictKey(bytes32 salt, bytes memory runtime) public view returns (address) {
        return RawCode.predict(address(this), salt, runtime);
    }

    /// @notice Account address for this salt and public-key blob. The blob address can itself be a prediction.
    function predictAccount(bytes32 salt, address pkBlob) public view returns (address) {
        bytes32 salted = keccak256(abi.encode(salt, pkBlob));
        bytes32 initHash = keccak256(
            abi.encodePacked(type(KetraAccount).creationCode, abi.encode(verifier, pkBlob, feeRecipient))
        );
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salted, initHash)))));
    }

    /// @param runtime Exact output of js/prepare.js: 20,545 bytes beginning with 0x00.
    ///        A blob whose t1 is degenerate is rejected. The matrix Ahat is not recomputed here.
    function deployKey(bytes32 salt, bytes calldata runtime) external returns (address pkBlob) {
        if (runtime.length != PK_BLOB_BYTES || runtime[0] != 0x00) revert BadBlob();
        T1Guard.requireSoundRuntime(runtime);
        pkBlob = RawCode.deploy(salt, runtime);
        if (pkBlob.code.length != PK_BLOB_BYTES || pkBlob.codehash != keccak256(runtime)) revert BadBlob();
        emit KeyDeployed(pkBlob, salt);
    }

    /// @notice Deploy the account that will only honor signatures under this blob.
    ///         The same salt and blob always produce the same account. A different blob is a different account.
    function createAccount(bytes32 salt, address pkBlob) external returns (address account) {
        if (pkBlob.code.length != PK_BLOB_BYTES) revert BadBlob();
        account = address(new KetraAccount{salt: keccak256(abi.encode(salt, pkBlob))}(verifier, pkBlob, feeRecipient));
        emit AccountCreated(account, pkBlob, salt);
    }
}
