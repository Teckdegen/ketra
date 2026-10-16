// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice ERC-20 calls that accept both standard bool returns and tokens that return nothing.
library TokenLib {
    error TokenCallFailed();

    function balanceOf(address token, address account) internal view returns (uint256) {
        (bool ok, bytes memory ret) = token.staticcall(abi.encodeWithSelector(0x70a08231, account));
        if (!ok || ret.length < 32) revert TokenCallFailed();
        return abi.decode(ret, (uint256));
    }

    function allowance(address token, address owner, address spender) internal view returns (uint256) {
        (bool ok, bytes memory ret) = token.staticcall(abi.encodeWithSelector(0xdd62ed3e, owner, spender));
        if (!ok || ret.length < 32) revert TokenCallFailed();
        return abi.decode(ret, (uint256));
    }

    /// @dev True when `token` answers balanceOf like an ERC-20.
    function isToken(address token) internal view returns (bool) {
        if (token.code.length == 0) return false;
        (bool ok, bytes memory ret) = token.staticcall(abi.encodeWithSelector(0x70a08231, address(this)));
        return ok && ret.length >= 32;
    }

    function safeTransfer(address token, address to, uint256 amount) internal {
        _call(token, abi.encodeWithSelector(0xa9059cbb, to, amount));
    }

    /// @dev Sets the allowance to zero first so tokens that reject a non-zero to non-zero change still work.
    function forceApprove(address token, address spender, uint256 amount) internal {
        _call(token, abi.encodeWithSelector(0x095ea7b3, spender, uint256(0)));
        if (amount != 0) _call(token, abi.encodeWithSelector(0x095ea7b3, spender, amount));
    }

    function _call(address token, bytes memory data) private {
        if (token.code.length == 0) revert TokenCallFailed();
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TokenCallFailed();
    }
}
