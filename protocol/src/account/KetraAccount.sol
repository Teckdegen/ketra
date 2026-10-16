// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {T1Guard} from "./T1Guard.sol";
import {IMLDSAVerifier} from "../verifier/IMLDSAVerifier.sol";
import {TokenLib} from "../lib/TokenLib.sol";
import {IUniswapV2Factory, IUniswapV2Router} from "../defi/IUniswapV2.sol";
import {ISwapRouter} from "../defi/ISwapRouter.sol";

/// @title KetraAccount
/// @notice Holds ETH and tokens. Every spend is a call this contract makes after ML-DSA-44 verification.
///         The transaction sender is never treated as authorization.
/// @dev The registered key is a prepared public-key blob (20,545 bytes from js/prepare.js), not the
///      raw 1,312-byte key. This contract always verifies against the blob stored at construction.
///      Registration rejects a degenerate t1. See docs/SAFETY.md.
contract KetraAccount {
    /// @dev Domain bound into every authorization hash.
    bytes32 public constant PROTOCOL_DOMAIN = keccak256("KETRA_V1");
    uint256 public constant PROTOCOL_VERSION = 1;
    uint256 public constant PK_BLOB_BYTES = 20545;
    /// @dev 0.1% of a send. 0.5% of a swap, a liquidity change, a deposit, or a withdrawal.
    uint256 public constant TRANSFER_FEE_BPS = 10;
    uint256 public constant DEFI_FEE_BPS = 50;
    /// @dev Robinhood Chain WETH. Wrapping and unwrapping keep the same asset, so they are free; the swap that follows pays.
    address public constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    uint8 public constant ACTION_CALL = 1;
    uint8 public constant ACTION_TRANSFER_ETH = 2;
    uint8 public constant ACTION_TRANSFER_TOKEN = 3;
    uint8 public constant ACTION_APPROVE = 4;
    uint8 public constant ACTION_SWAP_V2 = 5;
    uint8 public constant ACTION_SWAP_V3 = 6;
    uint8 public constant ACTION_ADD_LIQUIDITY_V2 = 7;
    uint8 public constant ACTION_REMOVE_LIQUIDITY_V2 = 8;
    uint8 public constant ACTION_SET_ALLOWED = 9;

    struct Step {
        uint8 action;
        bytes payload;
    }

    address public immutable verifier;
    address public immutable pkBlob;
    address public immutable feeRecipient;
    bytes32 public immutable pkCodehash;

    uint256 public nonce;
    mapping(address target => bool ok) public allowed;
    uint256 private transient _wethStart;

    uint256 private locked;

    error BadSignature();
    error BadNonce();
    error Expired();
    error BadKey();
    error BadValue();
    error Reentrancy();
    error Empty();
    error BadAction();
    error NotAllowed();
    error CallFailed();
    error Slippage();
    error ZeroAddress();
    error FeeUnpaid();
    error ApprovalLeft();

    event Executed(uint256 indexed nonce, bytes32 stepsHash);
    event AllowedSet(address indexed target, bool allowed);
    event FeeCollected(address indexed token, uint256 amount);
    event Received(address indexed from, uint256 amount);

    modifier nonReentrant() {
        if (locked == 1) revert Reentrancy();
        locked = 1;
        _;
        locked = 0;
    }

    constructor(address verifier_, address pkBlob_, address feeRecipient_) {
        if (verifier_.code.length == 0 || pkBlob_.code.length != PK_BLOB_BYTES) revert BadKey();
        if (feeRecipient_ == address(0) || feeRecipient_ == address(this)) revert ZeroAddress();
        T1Guard.requireSoundCode(pkBlob_);
        verifier = verifier_;
        pkBlob = pkBlob_;
        feeRecipient = feeRecipient_;
        pkCodehash = pkBlob_.codehash;
    }

    /// @notice Fee this action would take from `amount`. Sends are 0.1%. DeFi is 0.5%. Approvals and allowlist edits are free.
    function previewFee(uint8 action, uint256 amount) external pure returns (uint256) {
        if (action == ACTION_TRANSFER_ETH || action == ACTION_TRANSFER_TOKEN) return _cut(amount, TRANSFER_FEE_BPS);
        if (
            action == ACTION_CALL || action == ACTION_SWAP_V2 || action == ACTION_SWAP_V3
                || action == ACTION_ADD_LIQUIDITY_V2 || action == ACTION_REMOVE_LIQUIDITY_V2
        ) return _cut(amount, DEFI_FEE_BPS);
        return 0;
    }

    /// @dev Fits inside the 2300 gas stipend of transfer() and send().
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /// @notice Exact bytes the ML-DSA signer must sign for this account, chain, nonce, and steps.
    ///         `attachedValue` is the ETH that must arrive with the submission. It is usually zero.
    function authorizationMessage(uint256 nonce_, uint256 deadline, uint256 attachedValue, Step[] calldata steps)
        external
        view
        returns (bytes memory)
    {
        return _message(nonce_, deadline, attachedValue, steps);
    }

    /// @notice Verify one ML-DSA authorization and run every step. Anyone may submit it.
    function execute(
        uint256 nonce_,
        uint256 deadline,
        uint256 attachedValue,
        Step[] calldata steps,
        bytes calldata signature
    ) external payable nonReentrant {
        if (steps.length == 0) revert Empty();
        if (block.timestamp > deadline) revert Expired();
        if (nonce_ != nonce) revert BadNonce();
        if (msg.value != attachedValue) revert BadValue();
        if (pkBlob.code.length != PK_BLOB_BYTES || pkBlob.codehash != pkCodehash) revert BadKey();

        bytes memory message = _message(nonce_, deadline, attachedValue, steps);
        if (!IMLDSAVerifier(verifier).verify(pkBlob, message, signature)) revert BadSignature();

        nonce = nonce_ + 1;
        if (WETH.code.length != 0) _wethStart = TokenLib.balanceOf(WETH, address(this));
        for (uint256 i = 0; i < steps.length; ++i) {
            _run(steps, i);
        }
        _requireRevoked(steps);
        emit Executed(nonce_, keccak256(abi.encode(steps)));
    }

    /// @dev An allowance that outlives the batch would let a spender pull later without a fee.
    function _requireRevoked(Step[] calldata steps) internal view {
        for (uint256 i = 0; i < steps.length; ++i) {
            if (steps[i].action != ACTION_APPROVE) continue;
            (address token, address spender,) = abi.decode(steps[i].payload, (address, address, uint256));
            if (TokenLib.allowance(token, address(this), spender) != 0) revert ApprovalLeft();
        }
    }

    function _message(uint256 nonce_, uint256 deadline, uint256 attachedValue, Step[] calldata steps)
        internal
        view
        returns (bytes memory)
    {
        return abi.encode(
            PROTOCOL_DOMAIN,
            PROTOCOL_VERSION,
            block.chainid,
            address(this),
            nonce_,
            deadline,
            attachedValue,
            keccak256(abi.encode(steps))
        );
    }

    function _cut(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return (amount * bps) / 10_000;
    }

    function _sendEth(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert CallFailed();
    }

    /// @dev Pulls the fee to the immutable recipient and returns what remains for the signed action.
    function _takeEth(uint256 amount, uint256 bps) internal returns (uint256 net) {
        uint256 fee = _cut(amount, bps);
        if (fee == 0) return amount;
        _sendEth(feeRecipient, fee);
        emit FeeCollected(address(0), fee);
        return amount - fee;
    }

    function _takeToken(address token, uint256 amount, uint256 bps) internal returns (uint256 net) {
        uint256 fee = _cut(amount, bps);
        if (fee == 0) return amount;
        _sendTokenFee(token, fee);
        return amount - fee;
    }

    /// @dev WETH fees are unwrapped so the recipient always receives ETH.
    function _sendTokenFee(address token, uint256 fee) internal {
        if (token == WETH) {
            (bool ok,) = WETH.call(abi.encodeWithSelector(0x2e1a7d4d, fee));
            if (!ok) revert CallFailed();
            _sendEth(feeRecipient, fee);
            emit FeeCollected(address(0), fee);
        } else {
            TokenLib.safeTransfer(token, feeRecipient, fee);
            emit FeeCollected(token, fee);
        }
    }

    function _load(bytes memory data, uint256 offset) internal pure returns (uint256 word) {
        if (data.length < offset + 32) revert BadAction();
        assembly {
            word := mload(add(data, add(32, offset)))
        }
    }

    function _store(bytes memory data, uint256 offset, uint256 word) internal pure {
        assembly {
            mstore(add(data, add(32, offset)), word)
        }
    }

    function _selector(bytes memory data) internal pure returns (bytes4 sel) {
        assembly {
            sel := mload(add(data, 32))
        }
    }

    function _run(Step[] calldata steps, uint256 index) internal {
        Step calldata step = steps[index];
        uint8 action = step.action;
        if (action == ACTION_CALL) _execCall(steps, index);
        else if (action == ACTION_TRANSFER_ETH) _transferEth(step.payload);
        else if (action == ACTION_TRANSFER_TOKEN) _transferToken(step.payload);
        else if (action == ACTION_APPROVE) _approve(step.payload);
        else if (action == ACTION_SWAP_V2) _swapV2(step.payload);
        else if (action == ACTION_SWAP_V3) _swapV3(step.payload);
        else if (action == ACTION_ADD_LIQUIDITY_V2) _addLiquidityV2(step.payload);
        else if (action == ACTION_REMOVE_LIQUIDITY_V2) _removeLiquidityV2(step.payload);
        else if (action == ACTION_SET_ALLOWED) _setAllowed(step.payload);
        else revert BadAction();
    }

    function _execCall(Step[] calldata steps, uint256 index) internal {
        (address target, uint256 value, bytes memory data) = abi.decode(steps[index].payload, (address, uint256, bytes));
        if (!allowed[target] || target == address(this) || target.code.length == 0) revert NotAllowed();
        if (data.length >= 4) {
            bytes4 sel = _selector(data);
            if (
                sel == bytes4(0x095ea7b3) || sel == bytes4(0x39509351) || sel == bytes4(0xd505accf)
                    || sel == bytes4(0x36c78516) || sel == bytes4(0x0d58b1db)
            ) revert BadAction();
            if (target == WETH && (sel == bytes4(0xd0e30db0) || sel == bytes4(0x2e1a7d4d))) {
                if (sel == bytes4(0x2e1a7d4d) && _load(data, 4) == type(uint256).max) {
                    uint256 held = TokenLib.balanceOf(WETH, address(this));
                    _store(data, 4, held > _wethStart ? held - _wethStart : 0);
                }
                (bool wrapped,) = target.call{value: value}(data);
                if (!wrapped) revert CallFailed();
                return;
            }
            if (sel == bytes4(0x04e45aaf)) data = _feeSwap02(data);
            else if (sel == bytes4(0xa99aad89)) data = _feeMorpho(data);
            else if (sel == bytes4(0x6e553f65)) data = _feeDeposit(target, data);
            else if (sel == bytes4(0x8a857083)) data = _feeLighter(steps, index, target, data);
            else if (sel == bytes4(0x3593564c)) data = _feeUniversal(data);
            else if (sel == bytes4(0xb460af94) || sel == bytes4(0xba087652)) {
                _feeVaultExit(target, value, data);
                return;
            } else if (sel == bytes4(0x5c2bea49)) {
                _feeExit(target, value, data, address(uint160(_load(data, 4))), 260);
                return;
            } else if (sel == bytes4(0x8720316d)) {
                _feeExit(target, value, data, address(uint160(_load(data, 36))), 228);
                return;
            } else if (sel == bytes4(0x50d8cd4b)) {
                _feeExit(target, value, data, address(uint160(_load(data, 4))), 260);
                return;
            } else if (sel == bytes4(0x2f25807e)) {
                _feeLighterClaim(steps, index, target, value, data);
                return;
            } else {
                _feeMeasured(steps, index, target, value, data);
                return;
            }
        } else {
            _feeMeasured(steps, index, target, value, data);
            return;
        }
        if (value != 0) value = _takeEth(value, DEFI_FEE_BPS);
        (bool ok,) = target.call{value: value}(data);
        if (!ok) revert CallFailed();
    }

    /// @dev Any other call. The target, if it is a token, and every token approved to it in this batch are measured, and so is ETH.
    ///      What left the account pays 0.5% of itself. What arrived pays 0.5% only when nothing left, so a wrap or an
    ///      exchange pays once, on the side that went in.
    function _feeMeasured(Step[] calldata steps, uint256 index, address target, uint256 value, bytes memory data) internal {
        address[] memory tokens = _approvedTokens(steps, index, target);
        uint256[] memory beforeBalances = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            beforeBalances[i] = TokenLib.balanceOf(tokens[i], address(this));
        }
        bool paidOut = value != 0;
        if (value != 0) value = _takeEth(value, DEFI_FEE_BPS);
        uint256 ethBefore = address(this).balance;
        (bool ok,) = target.call{value: value}(data);
        if (!ok) revert CallFailed();

        uint256[] memory afterBalances = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            afterBalances[i] = TokenLib.balanceOf(tokens[i], address(this));
            if (afterBalances[i] < beforeBalances[i]) {
                paidOut = true;
                _pushFee(tokens[i], beforeBalances[i] - afterBalances[i], afterBalances[i]);
            }
        }
        if (paidOut) return;
        uint256 ethAfter = address(this).balance + value;
        if (ethAfter > ethBefore) {
            uint256 ethFee = _cut(ethAfter - ethBefore, DEFI_FEE_BPS);
            if (ethFee != 0) {
                _sendEth(feeRecipient, ethFee);
                emit FeeCollected(address(0), ethFee);
            }
        }
        for (uint256 i; i < tokens.length; ++i) {
            if (afterBalances[i] > beforeBalances[i]) {
                _pushFee(tokens[i], afterBalances[i] - beforeBalances[i], afterBalances[i]);
            }
        }
    }

    function _pushFee(address token, uint256 moved, uint256 held) internal {
        uint256 fee = _cut(moved, DEFI_FEE_BPS);
        if (fee == 0) return;
        if (held < fee) revert FeeUnpaid();
        _sendTokenFee(token, fee);
    }

    function _approvedTokens(Step[] calldata steps, uint256 index, address target) internal view returns (address[] memory tokens) {
        tokens = new address[](index + 1);
        uint256 count;
        if (TokenLib.isToken(target)) tokens[count++] = target;
        for (uint256 i; i < index; ++i) {
            if (steps[i].action != ACTION_APPROVE) continue;
            (address token, address spender, uint256 amount) = abi.decode(steps[i].payload, (address, address, uint256));
            if (spender != target || amount == 0) continue;
            bool seen;
            for (uint256 j; j < count; ++j) {
                if (tokens[j] == token) {
                    seen = true;
                    break;
                }
            }
            if (!seen) tokens[count++] = token;
        }
        assembly {
            mstore(tokens, count)
        }
    }

    function _feeSwap02(bytes memory data) internal returns (bytes memory) {
        address tokenIn = address(uint160(_load(data, 4)));
        uint256 amountIn = _load(data, 132);
        _store(data, 132, _takeToken(tokenIn, amountIn, DEFI_FEE_BPS));
        return data;
    }

    function _feeMorpho(bytes memory data) internal returns (bytes memory) {
        address loan = address(uint160(_load(data, 4)));
        uint256 assets = _load(data, 164);
        if (_load(data, 196) != 0) revert BadAction();
        _store(data, 164, _takeToken(loan, assets, DEFI_FEE_BPS));
        return data;
    }

    /// @dev Vault withdraw or redeem. The asset that arrives is cut, then the fee is pushed to the recipient.
    function _feeVaultExit(address vault, uint256 value, bytes memory data) internal {
        (bool ok, bytes memory ret) = vault.staticcall(abi.encodeWithSelector(0x38d52e0f));
        if (!ok || ret.length < 32) revert BadAction();
        address asset = abi.decode(ret, (address));
        _feeExit(vault, value, data, asset, 36);
    }

    /// @dev Runs the exit, then pushes 0.5% of the tokens that landed here. A signed outside receiver gets the rest.
    function _feeExit(address target, uint256 value, bytes memory data, address token, uint256 receiverOffset) internal {
        if (token == address(0)) revert ZeroAddress();
        address receiver = address(uint160(_load(data, receiverOffset)));
        if (receiver == address(0)) revert ZeroAddress();
        if (receiver != feeRecipient) _store(data, receiverOffset, uint256(uint160(address(this))));
        if (value != 0) value = _takeEth(value, DEFI_FEE_BPS);
        uint256 beforeBalance = TokenLib.balanceOf(token, address(this));
        (bool ok,) = target.call{value: value}(data);
        if (!ok) revert CallFailed();
        if (receiver == feeRecipient) return;
        uint256 received = TokenLib.balanceOf(token, address(this)) - beforeBalance;
        uint256 fee = _cut(received, DEFI_FEE_BPS);
        if (fee != 0) _sendTokenFee(token, fee);
        if (receiver != address(this)) {
            uint256 net = received - fee;
            if (net != 0) TokenLib.safeTransfer(token, receiver, net);
        }
    }

    /// @dev Lighter pays the asset out on this claim. The request itself does not move the token.
    function _feeLighterClaim(Step[] calldata steps, uint256 index, address target, uint256 value, bytes memory data) internal {
        address owner = address(uint160(_load(data, 4)));
        if (owner != address(this) && owner != feeRecipient) revert BadAction();
        address token = _approvedToken(steps, index, target);
        uint256 beforeBalance = TokenLib.balanceOf(token, address(this));
        if (value != 0) value = _takeEth(value, DEFI_FEE_BPS);
        (bool ok,) = target.call{value: value}(data);
        if (!ok) revert CallFailed();
        if (owner == feeRecipient) return;
        uint256 received = TokenLib.balanceOf(token, address(this)) - beforeBalance;
        uint256 fee = _cut(received, DEFI_FEE_BPS);
        if (fee != 0) _sendTokenFee(token, fee);
    }

    function _feeDeposit(address vault, bytes memory data) internal returns (bytes memory) {
        (bool ok, bytes memory ret) = vault.staticcall(abi.encodeWithSelector(0x38d52e0f));
        if (!ok || ret.length < 32) revert BadAction();
        address asset = abi.decode(ret, (address));
        if (asset == address(0)) revert ZeroAddress();
        uint256 assets = _load(data, 4);
        _store(data, 4, _takeToken(asset, assets, DEFI_FEE_BPS));
        return data;
    }

    function _feeLighter(Step[] calldata steps, uint256 index, address target, bytes memory data) internal returns (bytes memory) {
        address token = _approvedToken(steps, index, target);
        uint256 amount = _load(data, 100);
        _store(data, 100, _takeToken(token, amount, DEFI_FEE_BPS));
        return data;
    }

    /// @dev The v4 swap built by js/robinhood.js. One command 0x10, one input, actions swap/settle/take.
    function _feeUniversal(bytes memory data) internal returns (bytes memory) {
        if (data.length != 1124 || _load(data, 4) != 0x60 || _load(data, 100) != 1) revert BadAction();
        if (_load(data, 132) != (uint256(uint8(0x10)) << 248)) revert BadAction();
        address token = address(uint160(_load(data, 964)));
        uint256 amount = _load(data, 772);
        if (token == address(0) || amount == 0 || amount != _load(data, 996)) revert BadAction();
        uint256 net = _takeToken(token, amount, DEFI_FEE_BPS);
        _store(data, 772, net);
        _store(data, 996, net);
        return data;
    }

    function _approvedToken(Step[] calldata steps, uint256 index, address target) internal pure returns (address token) {
        for (uint256 i = index; i > 0;) {
            unchecked {
                --i;
            }
            if (steps[i].action != ACTION_APPROVE) continue;
            (address t, address spender, uint256 amount) = abi.decode(steps[i].payload, (address, address, uint256));
            if (spender == target && amount != 0) return t;
        }
        revert BadAction();
    }

    function _transferEth(bytes calldata payload) internal {
        (address to, uint256 amount) = abi.decode(payload, (address, uint256));
        if (to == address(0)) revert ZeroAddress();
        uint256 net = to == feeRecipient ? amount : _takeEth(amount, TRANSFER_FEE_BPS);
        _sendEth(to, net);
    }

    function _transferToken(bytes calldata payload) internal {
        (address token, address to, uint256 amount) = abi.decode(payload, (address, address, uint256));
        if (to == address(0)) revert ZeroAddress();
        uint256 net = to == feeRecipient ? amount : _takeToken(token, amount, TRANSFER_FEE_BPS);
        if (net != 0) TokenLib.safeTransfer(token, to, net);
    }

    function _approve(bytes calldata payload) internal {
        (address token, address spender, uint256 amount) = abi.decode(payload, (address, address, uint256));
        if (!allowed[spender] || spender == address(this)) revert NotAllowed();
        TokenLib.forceApprove(token, spender, amount);
    }

    function _setAllowed(bytes calldata payload) internal {
        (address target, bool on) = abi.decode(payload, (address, bool));
        if (target == address(0) || target == address(this)) revert ZeroAddress();
        allowed[target] = on;
        emit AllowedSet(target, on);
    }

    function _swapV2(bytes calldata payload) internal {
        (address router, uint256 amountIn, uint256 amountOutMin, address[] memory path, uint256 swapDeadline) =
            abi.decode(payload, (address, uint256, uint256, address[], uint256));
        if (!allowed[router] || router.code.length == 0 || path.length < 2) revert NotAllowed();
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];
        if (tokenIn == address(0) || tokenOut == address(0) || tokenIn == tokenOut) revert BadAction();

        uint256 netIn = _takeToken(tokenIn, amountIn, DEFI_FEE_BPS);
        TokenLib.forceApprove(tokenIn, router, netIn);
        uint256 beforeOut = TokenLib.balanceOf(tokenOut, address(this));
        IUniswapV2Router(router).swapExactTokensForTokens(netIn, amountOutMin, path, address(this), swapDeadline);
        TokenLib.forceApprove(tokenIn, router, 0);
        if (TokenLib.balanceOf(tokenOut, address(this)) - beforeOut < amountOutMin) revert Slippage();
    }

    function _swapV3(bytes calldata payload) internal {
        (
            address router,
            address tokenIn,
            address tokenOut,
            uint24 fee,
            uint256 amountIn,
            uint256 amountOutMin,
            uint160 sqrtPriceLimitX96,
            uint256 swapDeadline
        ) = abi.decode(payload, (address, address, address, uint24, uint256, uint256, uint160, uint256));
        if (!allowed[router] || router.code.length == 0) revert NotAllowed();
        if (tokenIn == address(0) || tokenOut == address(0) || tokenIn == tokenOut) revert BadAction();

        uint256 netIn = _takeToken(tokenIn, amountIn, DEFI_FEE_BPS);
        TokenLib.forceApprove(tokenIn, router, netIn);
        uint256 beforeOut = TokenLib.balanceOf(tokenOut, address(this));
        ISwapRouter(router)
            .exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: fee,
                    recipient: address(this),
                    deadline: swapDeadline,
                    amountIn: netIn,
                    amountOutMinimum: amountOutMin,
                    sqrtPriceLimitX96: sqrtPriceLimitX96
                })
            );
        TokenLib.forceApprove(tokenIn, router, 0);
        if (TokenLib.balanceOf(tokenOut, address(this)) - beforeOut < amountOutMin) revert Slippage();
    }

    function _addLiquidityV2(bytes calldata payload) internal {
        (
            address router,
            address tokenA,
            address tokenB,
            uint256 amountADesired,
            uint256 amountBDesired,
            uint256 amountAMin,
            uint256 amountBMin,
            uint256 swapDeadline
        ) = abi.decode(payload, (address, address, address, uint256, uint256, uint256, uint256, uint256));
        if (!allowed[router] || router.code.length == 0) revert NotAllowed();
        if (tokenA == address(0) || tokenB == address(0) || tokenA == tokenB) revert BadAction();

        address pair = IUniswapV2Factory(IUniswapV2Router(router).factory()).getPair(tokenA, tokenB);
        if (pair.code.length == 0) revert BadAction();

        uint256 netA = _takeToken(tokenA, amountADesired, DEFI_FEE_BPS);
        uint256 netB = _takeToken(tokenB, amountBDesired, DEFI_FEE_BPS);
        uint256 lpBefore = TokenLib.balanceOf(pair, address(this));
        TokenLib.forceApprove(tokenA, router, netA);
        TokenLib.forceApprove(tokenB, router, netB);
        IUniswapV2Router(router).addLiquidity(tokenA, tokenB, netA, netB, amountAMin, amountBMin, address(this), swapDeadline);
        TokenLib.forceApprove(tokenA, router, 0);
        TokenLib.forceApprove(tokenB, router, 0);
        if (TokenLib.balanceOf(pair, address(this)) <= lpBefore) revert Slippage();
    }

    function _removeLiquidityV2(bytes calldata payload) internal {
        (
            address router,
            address pair,
            address tokenA,
            address tokenB,
            uint256 liquidity,
            uint256 amountAMin,
            uint256 amountBMin,
            uint256 swapDeadline
        ) = abi.decode(payload, (address, address, address, address, uint256, uint256, uint256, uint256));
        if (!allowed[router] || router.code.length == 0 || pair.code.length == 0) revert NotAllowed();
        if (tokenA == address(0) || tokenB == address(0) || tokenA == tokenB) revert BadAction();

        uint256 netLp = _takeToken(pair, liquidity, DEFI_FEE_BPS);
        uint256 beforeA = TokenLib.balanceOf(tokenA, address(this));
        uint256 beforeB = TokenLib.balanceOf(tokenB, address(this));
        TokenLib.forceApprove(pair, router, netLp);
        IUniswapV2Router(router)
            .removeLiquidity(tokenA, tokenB, netLp, amountAMin, amountBMin, address(this), swapDeadline);
        TokenLib.forceApprove(pair, router, 0);
        if (TokenLib.balanceOf(tokenA, address(this)) - beforeA < amountAMin) revert Slippage();
        if (TokenLib.balanceOf(tokenB, address(this)) - beforeB < amountBMin) revert Slippage();
    }
}
