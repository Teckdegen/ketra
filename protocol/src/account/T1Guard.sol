// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Rejects a public-key blob whose t1 is forgeable.
///         t1hat is inverted back to t1. A coefficient is large when its centred
///         lift exceeds gamma2. Fewer than half large means the key is degenerate.
library T1Guard {
    uint256 internal constant Q = 8380417;
    uint256 internal constant ZETA = 1753;
    uint256 internal constant INV256 = 8347681;
    uint256 internal constant GAMMA2 = 95232;
    uint256 internal constant MIN_LARGE = 512;

    error BadBlob();
    error DegenerateKey();

    function requireSoundRuntime(bytes calldata runtime) internal pure {
        if (runtime.length != 20545 || runtime[0] != 0x00) revert BadBlob();
        uint256[256] memory z = zetas();
        uint256[256] memory w;
        uint256 large;
        for (uint256 poly = 0; poly < 4; poly++) {
            loadCalldata(runtime, 65 + poly * 1024, w);
            large += screen(w, z);
        }
        if (large < MIN_LARGE) revert DegenerateKey();
    }

    function requireSoundCode(address blob) internal view {
        if (blob.code.length != 20545) revert BadBlob();
        uint256 head;
        assembly ("memory-safe") {
            extcodecopy(blob, 0, 0, 32)
            head := mload(0)
        }
        if (head >> 248 != 0) revert BadBlob();
        uint256[256] memory z = zetas();
        uint256[256] memory w;
        uint256 large;
        for (uint256 poly = 0; poly < 4; poly++) {
            loadCode(blob, 65 + poly * 1024, w);
            large += screen(w, z);
        }
        if (large < MIN_LARGE) revert DegenerateKey();
    }

    function screen(uint256[256] memory w, uint256[256] memory z) private pure returns (uint256 large) {
        invNtt(w, z);
        for (uint256 i = 0; i < 256; i++) {
            uint256 c = w[i];
            if (c % 8192 != 0) revert BadBlob();
            uint256 shifted = (c >> 13) << 13;
            uint256 lift = shifted > Q / 2 ? Q - shifted : shifted;
            if (lift > GAMMA2) large++;
        }
    }

    function invNtt(uint256[256] memory w, uint256[256] memory z) private pure {
        uint256 len = 1;
        uint256 m = 256;
        while (len < 256) {
            uint256 start = 0;
            while (start < 256) {
                m -= 1;
                uint256 zeta = Q - z[m];
                uint256 end = start + len;
                for (uint256 j = start; j < end; j++) {
                    uint256 t = w[j];
                    uint256 right = w[j + len];
                    w[j] = addmod(t, right, Q);
                    w[j + len] = mulmod(zeta, addmod(t, Q - (right % Q), Q), Q);
                }
                start = end + len;
            }
            len <<= 1;
        }
        for (uint256 j = 0; j < 256; j++) w[j] = mulmod(INV256, w[j], Q);
    }

    function loadCalldata(bytes calldata blob, uint256 off, uint256[256] memory w) private pure {
        for (uint256 word = 0; word < 32; word++) {
            uint256 packed;
            uint256 pos = off + word * 32;
            assembly ("memory-safe") {
                packed := calldataload(add(blob.offset, pos))
            }
            storeWord(w, word, packed);
        }
    }

    function loadCode(address blob, uint256 off, uint256[256] memory w) private view {
        for (uint256 word = 0; word < 32; word++) {
            uint256 packed;
            uint256 pos = off + word * 32;
            assembly ("memory-safe") {
                extcodecopy(blob, 0, pos, 32)
                packed := mload(0)
            }
            storeWord(w, word, packed);
        }
    }

    function storeWord(uint256[256] memory w, uint256 word, uint256 packed) private pure {
        for (uint256 s = 0; s < 8; s++) {
            w[word * 8 + s] = ((packed >> (32 * s)) & 0xffffffff) % Q;
        }
    }

    function zetas() private pure returns (uint256[256] memory z) {
        for (uint256 i = 0; i < 256; i++) z[i] = modPow(ZETA, brv8(i));
    }

    function brv8(uint256 i) private pure returns (uint256 r) {
        uint256 x = i & 0xff;
        for (uint256 b = 0; b < 8; b++) {
            r = (r << 1) | (x & 1);
            x >>= 1;
        }
    }

    function modPow(uint256 base, uint256 exp) private pure returns (uint256 r) {
        r = 1;
        uint256 b = base % Q;
        while (exp > 0) {
            if (exp & 1 == 1) r = mulmod(r, b, Q);
            b = mulmod(b, b, Q);
            exp >>= 1;
        }
    }
}
