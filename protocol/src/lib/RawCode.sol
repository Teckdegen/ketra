// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Deploys raw runtime bytecode with CREATE2. The deployed code is the runtime itself.
library RawCode {
    error RawDeployFailed();

    function initCode(bytes memory runtime) internal pure returns (bytes memory) {
        return abi.encodePacked(
            bytes1(0x61),
            uint16(runtime.length),
            hex"600e600039",
            bytes1(0x61),
            uint16(runtime.length),
            hex"6000f3",
            runtime
        );
    }

    function predict(address deployer, bytes32 salt, bytes memory runtime) internal pure returns (address) {
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, keccak256(initCode(runtime))))))
        );
    }

    function deploy(bytes32 salt, bytes memory runtime) internal returns (address at) {
        bytes memory init = initCode(runtime);
        assembly ("memory-safe") {
            at := create2(0, add(init, 0x20), mload(init), salt)
        }
        if (at == address(0)) revert RawDeployFailed();
    }
}
