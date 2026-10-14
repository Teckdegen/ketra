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
    bytes32 public immutable pkCodehash;

    uint256 public nonce;
    mapping(address target => bool ok) public allowed;

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

    event Executed(uint256 indexed nonce, bytes32 stepsHash);
    event AllowedSet(address indexed target, bool allowed);

    modifier nonReentrant() {
        if (locked == 1) revert Reentrancy();
        locked = 1;
        _;
        locked = 0;
    }

    constructor(address verifier_, address pkBlob_) {
        if (verifier_.code.length == 0 || pkBlob_.code.length != PK_BLOB_BYTES) revert BadKey();
        T1Guard.requireSoundCode(pkBlob_);
        verifier = verifier_;
        pkBlob = pkBlob_;
        pkCodehash = pkBlob_.codehash;
    }

    receive() external payable {}

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
        for (uint256 i = 0; i < steps.length; ++i) {
            _run(steps[i]);
        }
        emit Executed(nonce_, keccak256(abi.encode(steps)));
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

    function _run(Step calldata step) internal {
        uint8 action = step.action;
        if (action == ACTION_CALL) _execCall(step.payload);
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

    function _execCall(bytes calldata payload) internal {
        (address target, uint256 value, bytes memory data) = abi.decode(payload, (address, uint256, bytes));
        if (!allowed[target] || target == address(this) || target.code.length == 0) revert NotAllowed();
        (bool ok,) = target.call{value: value}(data);
        if (!ok) revert CallFailed();
    }

    function _transferEth(bytes calldata payload) internal {
        (address to, uint256 amount) = abi.decode(payload, (address, uint256));
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert CallFailed();
    }

    function _transferToken(bytes calldata payload) internal {
        (address token, address to, uint256 amount) = abi.decode(payload, (address, address, uint256));
        if (to == address(0)) revert ZeroAddress();
        TokenLib.safeTransfer(token, to, amount);
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

        TokenLib.forceApprove(tokenIn, router, amountIn);
        uint256 beforeOut = TokenLib.balanceOf(tokenOut, address(this));
        IUniswapV2Router(router)
            .swapExactTokensForTokens(amountIn, amountOutMin, path, address(this), swapDeadline);
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

        TokenLib.forceApprove(tokenIn, router, amountIn);
        uint256 beforeOut = TokenLib.balanceOf(tokenOut, address(this));
        ISwapRouter(router)
            .exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: fee,
                    recipient: address(this),
                    deadline: swapDeadline,
                    amountIn: amountIn,
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

        uint256 lpBefore = TokenLib.balanceOf(pair, address(this));
        TokenLib.forceApprove(tokenA, router, amountADesired);
        TokenLib.forceApprove(tokenB, router, amountBDesired);
        IUniswapV2Router(router)
            .addLiquidity(
                tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, address(this), swapDeadline
            );
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

        uint256 beforeA = TokenLib.balanceOf(tokenA, address(this));
        uint256 beforeB = TokenLib.balanceOf(tokenB, address(this));
        TokenLib.forceApprove(pair, router, liquidity);
        IUniswapV2Router(router)
            .removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, address(this), swapDeadline);
        TokenLib.forceApprove(pair, router, 0);
        if (TokenLib.balanceOf(tokenA, address(this)) - beforeA < amountAMin) revert Slippage();
        if (TokenLib.balanceOf(tokenB, address(this)) - beforeB < amountBMin) revert Slippage();
    }
}
