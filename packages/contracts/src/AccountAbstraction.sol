// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IAccount {
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

interface IPaymaster {
    enum PostOpMode {
        OpSucceeded,
        OpReverted
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost, uint256 actualUserOpFeePerGas) external;
}

contract PopularConsensusEntryPoint {
    mapping(address => uint256) public deposits;

    event Deposited(address indexed account, address indexed depositor, uint256 amount);
    event Withdrawn(address indexed account, address indexed recipient, uint256 amount);
    event UserOperationHandled(address indexed sender, bytes32 indexed userOpHash, address indexed paymaster, bool success, bytes result);

    receive() external payable {
        deposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.sender, msg.value);
    }

    function depositTo(address account) external payable {
        require(account != address(0), "AA: deposit account");
        deposits[account] += msg.value;
        emit Deposited(account, msg.sender, msg.value);
    }

    function withdrawTo(address payable recipient, uint256 amount) external {
        require(recipient != address(0), "AA: recipient");
        require(deposits[msg.sender] >= amount, "AA: deposit");
        deposits[msg.sender] -= amount;
        recipient.transfer(amount);
        emit Withdrawn(msg.sender, recipient, amount);
    }

    function balanceOf(address account) external view returns (uint256) {
        return deposits[account];
    }

    function handleOps(PackedUserOperation[] calldata ops, address payable) external {
        bytes32[] memory userOpHashes = new bytes32[](ops.length);
        address[] memory paymasters = new address[](ops.length);
        bytes[] memory paymasterContexts = new bytes[](ops.length);

        for (uint256 index = 0; index < ops.length; index += 1) {
            PackedUserOperation calldata op = ops[index];
            if (op.sender.code.length == 0) {
                _createSender(op.initCode);
                require(op.sender.code.length > 0, "AA: sender not deployed");
            }

            bytes32 userOpHash = getUserOpHash(op);
            userOpHashes[index] = userOpHash;

            uint256 validationData = IAccount(op.sender).validateUserOp(op, userOpHash, 0);
            require(validationData == 0, "AA: account validation failed");

            address paymaster = _paymasterOf(op.paymasterAndData);
            if (paymaster != address(0)) {
                (bytes memory context, uint256 paymasterValidationData) = IPaymaster(paymaster).validatePaymasterUserOp(op, userOpHash, 0);
                require(paymasterValidationData == 0, "AA: paymaster validation failed");
                paymasters[index] = paymaster;
                paymasterContexts[index] = context;
            }
        }

        for (uint256 index = 0; index < ops.length; index += 1) {
            PackedUserOperation calldata op = ops[index];
            (bool success, bytes memory result) = op.sender.call(op.callData);
            address paymaster = paymasters[index];
            if (paymaster != address(0)) {
                IPaymaster.PostOpMode mode = success ? IPaymaster.PostOpMode.OpSucceeded : IPaymaster.PostOpMode.OpReverted;
                IPaymaster(paymaster).postOp(mode, paymasterContexts[index], 0, 0);
            }
            emit UserOperationHandled(op.sender, userOpHashes[index], paymaster, success, result);
            require(success, "AA: execution failed");
        }

    }

    function getUserOpHash(PackedUserOperation calldata op) public view returns (bytes32) {
        return keccak256(abi.encode(packUserOp(op), address(this), block.chainid));
    }

    function packUserOp(PackedUserOperation calldata op) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                op.sender,
                op.nonce,
                keccak256(op.initCode),
                keccak256(op.callData),
                op.accountGasLimits,
                op.preVerificationGas,
                op.gasFees,
                keccak256(op.paymasterAndData)
            )
        );
    }

    function _createSender(bytes calldata initCode) internal {
        require(initCode.length >= 20, "AA: initCode");
        address factory;
        assembly {
            factory := shr(96, calldataload(initCode.offset))
        }
        bytes calldata factoryData = initCode[20:];
        (bool success,) = factory.call(factoryData);
        require(success, "AA: factory failed");
    }

    function _paymasterOf(bytes calldata paymasterAndData) internal pure returns (address paymaster) {
        if (paymasterAndData.length == 0) return address(0);
        require(paymasterAndData.length >= 20, "AA: paymaster data");
        assembly {
            paymaster := shr(96, calldataload(paymasterAndData.offset))
        }
    }
}

contract PopularConsensusAccount {
    uint8 private constant SIGNATURE_KIND_WALLET = 0;
    uint8 private constant SIGNATURE_KIND_PASSKEY = 1;
    uint256 private constant SIG_VALIDATION_FAILED = 1;
    uint256 private constant SECP256K1_HALF_ORDER = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    address public immutable entryPoint;
    address public immutable p256Verifier;
    address public immutable walletController;
    bytes32 public immutable passkeyX;
    bytes32 public immutable passkeyY;
    uint256 public nonce;

    event Executed(address indexed target, uint256 value, bytes data, bytes result);
    event BatchExecuted(uint256 callCount);
    event UserOperationValidated(bytes32 indexed userOpHash, uint8 signatureKind);

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "PCAccount: entry point");
        _;
    }

    modifier onlyEntryPointOrSelf() {
        require(msg.sender == entryPoint || msg.sender == address(this), "PCAccount: authority");
        _;
    }

    constructor(address entryPoint_, address p256Verifier_, address walletController_, bytes32 passkeyX_, bytes32 passkeyY_) payable {
        require(entryPoint_ != address(0), "PCAccount: entry point");
        require(walletController_ != address(0) || (passkeyX_ != bytes32(0) && passkeyY_ != bytes32(0)), "PCAccount: controller");
        entryPoint = entryPoint_;
        p256Verifier = p256Verifier_;
        walletController = walletController_;
        passkeyX = passkeyX_;
        passkeyY = passkeyY_;
    }

    receive() external payable {}

    function execute(address target, uint256 value, bytes calldata data) external onlyEntryPointOrSelf returns (bytes memory result) {
        require(target != address(0), "PCAccount: target");
        (bool success, bytes memory callResult) = target.call{ value: value }(data);
        require(success, "PCAccount: execute failed");
        emit Executed(target, value, data, callResult);
        return callResult;
    }

    function executeBatch(address[] calldata targets, uint256[] calldata values, bytes[] calldata payloads) external onlyEntryPointOrSelf {
        require(targets.length == values.length && targets.length == payloads.length, "PCAccount: batch length");
        for (uint256 index = 0; index < targets.length; index += 1) {
            require(targets[index] != address(0), "PCAccount: target");
            (bool success,) = targets[index].call{ value: values[index] }(payloads[index]);
            require(success, "PCAccount: batch failed");
        }
        emit BatchExecuted(targets.length);
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        require(userOp.sender == address(this), "PCAccount: sender");
        require(userOp.nonce == nonce, "PCAccount: nonce");

        (bool valid, uint8 signatureKind) = _validateControllerSignature(userOpHash, userOp.signature);
        if (!valid) return SIG_VALIDATION_FAILED;

        nonce += 1;
        if (missingAccountFunds > 0) {
            (bool paid,) = payable(msg.sender).call{ value: missingAccountFunds }("");
            require(paid, "PCAccount: prefund");
        }
        emit UserOperationValidated(userOpHash, signatureKind);
        return 0;
    }

    function _validateControllerSignature(bytes32 userOpHash, bytes calldata signature) internal view returns (bool valid, uint8 signatureKind) {
        if (signature.length == 0) return (false, 0);
        signatureKind = uint8(signature[0]);
        bytes calldata payload = signature[1:];

        if (signatureKind == SIGNATURE_KIND_WALLET) {
            return (_validateWalletSignature(userOpHash, payload), signatureKind);
        }

        if (signatureKind == SIGNATURE_KIND_PASSKEY) {
            return (_validatePasskeySignature(userOpHash, payload), signatureKind);
        }

        return (false, signatureKind);
    }

    function _validateWalletSignature(bytes32 userOpHash, bytes calldata payload) internal view returns (bool) {
        if (walletController == address(0) || payload.length != 65) return false;

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(payload.offset)
            s := calldataload(add(payload.offset, 32))
            v := byte(0, calldataload(add(payload.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return false;
        if (uint256(s) > SECP256K1_HALF_ORDER) return false;
        return ecrecover(_toEthSignedMessageHash(userOpHash), v, r, s) == walletController;
    }

    function _validatePasskeySignature(bytes32 userOpHash, bytes calldata payload) internal view returns (bool) {
        if (p256Verifier == address(0) || passkeyX == bytes32(0) || passkeyY == bytes32(0)) return false;

        (bytes memory authenticatorData, bytes memory clientDataJSON, uint256 challengeOffset, bytes32 r, bytes32 s) =
            abi.decode(payload, (bytes, bytes, uint256, bytes32, bytes32));

        if (authenticatorData.length < 37) return false;
        if ((uint8(authenticatorData[32]) & 0x01) == 0) return false;
        if (!_clientDataChallengeMatchesUserOpHash(clientDataJSON, challengeOffset, userOpHash)) return false;

        bytes32 clientDataHash = sha256(clientDataJSON);
        bytes32 webAuthnHash = sha256(abi.encodePacked(authenticatorData, clientDataHash));
        return _verifyP256(webAuthnHash, r, s);
    }

    function _verifyP256(bytes32 digest, bytes32 r, bytes32 s) internal view returns (bool) {
        (bool success, bytes memory result) = p256Verifier.staticcall(abi.encode(digest, r, s, passkeyX, passkeyY));
        return success && result.length == 32 && abi.decode(result, (uint256)) == 1;
    }

    function _clientDataChallengeMatchesUserOpHash(
        bytes memory clientDataJSON,
        uint256 challengeOffset,
        bytes32 userOpHash
    ) internal pure returns (bool) {
        bytes memory prefix = bytes("\"challenge\":\"");
        bytes memory expectedChallenge = _base64UrlEncode32(userOpHash);

        if (challengeOffset < prefix.length) return false;
        if (challengeOffset + expectedChallenge.length >= clientDataJSON.length) return false;
        for (uint256 index = 0; index < prefix.length; index += 1) {
            if (clientDataJSON[challengeOffset - prefix.length + index] != prefix[index]) return false;
        }
        for (uint256 index = 0; index < expectedChallenge.length; index += 1) {
            if (clientDataJSON[challengeOffset + index] != expectedChallenge[index]) return false;
        }
        return clientDataJSON[challengeOffset + expectedChallenge.length] == bytes1("\"");
    }

    function _base64UrlEncode32(bytes32 value) internal pure returns (bytes memory) {
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        bytes memory data = abi.encodePacked(value);
        bytes memory output = new bytes(43);
        uint256 outIndex = 0;

        for (uint256 index = 0; index < 30; index += 3) {
            uint256 chunk =
                (uint256(uint8(data[index])) << 16) | (uint256(uint8(data[index + 1])) << 8) | uint256(uint8(data[index + 2]));
            output[outIndex] = alphabet[(chunk >> 18) & 0x3f];
            output[outIndex + 1] = alphabet[(chunk >> 12) & 0x3f];
            output[outIndex + 2] = alphabet[(chunk >> 6) & 0x3f];
            output[outIndex + 3] = alphabet[chunk & 0x3f];
            outIndex += 4;
        }

        uint256 tail = (uint256(uint8(data[30])) << 16) | (uint256(uint8(data[31])) << 8);
        output[outIndex] = alphabet[(tail >> 18) & 0x3f];
        output[outIndex + 1] = alphabet[(tail >> 12) & 0x3f];
        output[outIndex + 2] = alphabet[(tail >> 6) & 0x3f];
        return output;
    }

    function _toEthSignedMessageHash(bytes32 digest) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
    }
}

contract PopularConsensusAccountFactory {
    address public immutable entryPoint;
    address public immutable p256Verifier;

    event AccountCreated(
        address indexed account,
        address indexed walletController,
        bytes32 indexed salt,
        bytes32 passkeyX,
        bytes32 passkeyY
    );

    constructor(address entryPoint_, address p256Verifier_) {
        require(entryPoint_ != address(0), "Factory: entry point");
        entryPoint = entryPoint_;
        p256Verifier = p256Verifier_;
    }

    function createAccount(
        address walletController,
        bytes32 passkeyX,
        bytes32 passkeyY,
        bytes32 salt
    ) external returns (address account) {
        account = getAddress(walletController, passkeyX, passkeyY, salt);
        if (account.code.length > 0) return account;

        PopularConsensusAccount deployed = new PopularConsensusAccount{ salt: salt }(
            entryPoint,
            p256Verifier,
            walletController,
            passkeyX,
            passkeyY
        );
        account = address(deployed);
        emit AccountCreated(account, walletController, salt, passkeyX, passkeyY);
    }

    function getAddress(
        address walletController,
        bytes32 passkeyX,
        bytes32 passkeyY,
        bytes32 salt
    ) public view returns (address) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(PopularConsensusAccount).creationCode,
                abi.encode(entryPoint, p256Verifier, walletController, passkeyX, passkeyY)
            )
        );
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash)))));
    }

    function saltForWallet(address walletController) external pure returns (bytes32) {
        require(walletController != address(0), "Factory: wallet");
        return keccak256(abi.encodePacked("popular-consensus-aa-wallet-v1", walletController));
    }

    function saltForPasskey(bytes32 credentialIdHash) external pure returns (bytes32) {
        require(credentialIdHash != bytes32(0), "Factory: credential");
        return keccak256(abi.encodePacked("popular-consensus-aa-passkey-v1", credentialIdHash));
    }
}

contract PopularConsensusP256Verifier {
    uint256 private constant P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff;
    uint256 private constant N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551;
    uint256 private constant B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b;
    uint256 private constant GX = 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296;
    uint256 private constant GY = 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5;
    address private constant MODEXP = address(0x05);

    struct JPoint {
        uint256 x;
        uint256 y;
        uint256 z;
    }

    fallback(bytes calldata data) external returns (bytes memory) {
        if (data.length != 160) return abi.encode(uint256(0));
        (bytes32 digest, bytes32 r, bytes32 s, bytes32 x, bytes32 y) = abi.decode(data, (bytes32, bytes32, bytes32, bytes32, bytes32));
        return abi.encode(verify(digest, r, s, x, y) ? uint256(1) : uint256(0));
    }

    function verify(bytes32 digest, bytes32 rBytes, bytes32 sBytes, bytes32 xBytes, bytes32 yBytes) public view returns (bool) {
        uint256 r = uint256(rBytes);
        uint256 s = uint256(sBytes);
        uint256 qx = uint256(xBytes);
        uint256 qy = uint256(yBytes);
        if (r == 0 || r >= N || s == 0 || s >= N) return false;
        if (!_isOnCurve(qx, qy)) return false;

        uint256 sInv = _inverse(s, N);
        uint256 u1 = mulmod(uint256(digest), sInv, N);
        uint256 u2 = mulmod(r, sInv, N);
        JPoint memory point = _jointMul(u1, u2, qx, qy);
        if (point.z == 0) return false;

        uint256 zInv = _inverse(point.z, P);
        uint256 zInv2 = mulmod(zInv, zInv, P);
        uint256 affineX = mulmod(point.x, zInv2, P);
        return affineX % N == r;
    }

    function _jointMul(uint256 u1, uint256 u2, uint256 qx, uint256 qy) internal pure returns (JPoint memory point) {
        for (uint256 bit = 256; bit > 0; bit -= 1) {
            if (point.z != 0) point = _double(point);
            uint256 shift = bit - 1;
            if (((u1 >> shift) & 1) == 1) point = _addMixed(point, GX, GY);
            if (((u2 >> shift) & 1) == 1) point = _addMixed(point, qx, qy);
        }
    }

    function _isOnCurve(uint256 x, uint256 y) internal pure returns (bool) {
        if (x == 0 || x >= P || y == 0 || y >= P) return false;
        uint256 y2 = mulmod(y, y, P);
        uint256 x2 = mulmod(x, x, P);
        uint256 x3 = mulmod(x2, x, P);
        uint256 threeX = mulmod(3, x, P);
        uint256 rhs = addmod(_sub(x3, threeX), B, P);
        return y2 == rhs;
    }

    function _double(JPoint memory point) internal pure returns (JPoint memory result) {
        if (point.z == 0 || point.y == 0) return result;

        uint256 delta = mulmod(point.z, point.z, P);
        uint256 gamma = mulmod(point.y, point.y, P);
        uint256 beta = mulmod(point.x, gamma, P);
        uint256 alpha = mulmod(3, mulmod(_sub(point.x, delta), addmod(point.x, delta, P), P), P);
        uint256 x3 = _sub(mulmod(alpha, alpha, P), mulmod(8, beta, P));
        uint256 z3 = _sub(_sub(mulmod(addmod(point.y, point.z, P), addmod(point.y, point.z, P), P), gamma), delta);
        uint256 y3 = _sub(mulmod(alpha, _sub(mulmod(4, beta, P), x3), P), mulmod(8, mulmod(gamma, gamma, P), P));

        return JPoint({ x: x3, y: y3, z: z3 });
    }

    function _addMixed(JPoint memory point, uint256 x2, uint256 y2) internal pure returns (JPoint memory result) {
        if (point.z == 0) return JPoint({ x: x2, y: y2, z: 1 });

        uint256 z1z1 = mulmod(point.z, point.z, P);
        uint256 u2 = mulmod(x2, z1z1, P);
        uint256 s2 = mulmod(y2, mulmod(point.z, z1z1, P), P);
        uint256 h = _sub(u2, point.x);

        if (h == 0) {
            if (s2 == point.y) return _double(point);
            return result;
        }

        return _addMixedUnchecked(point, h, z1z1, s2);
    }

    function _addMixedUnchecked(
        JPoint memory point,
        uint256 h,
        uint256 z1z1,
        uint256 s2
    ) internal pure returns (JPoint memory) {
        uint256[7] memory terms;
        terms[0] = mulmod(h, h, P); // HH
        terms[1] = mulmod(4, terms[0], P); // I
        terms[2] = mulmod(h, terms[1], P); // J
        terms[3] = mulmod(2, _sub(s2, point.y), P); // r
        terms[4] = mulmod(point.x, terms[1], P); // V
        terms[5] = _sub(_sub(mulmod(terms[3], terms[3], P), terms[2]), mulmod(2, terms[4], P)); // X3
        terms[6] = _sub(_sub(mulmod(addmod(point.z, h, P), addmod(point.z, h, P), P), z1z1), terms[0]); // Z3

        return JPoint({
            x: terms[5],
            y: _sub(mulmod(terms[3], _sub(terms[4], terms[5]), P), mulmod(2, mulmod(point.y, terms[2], P), P)),
            z: terms[6]
        });
    }

    function _inverse(uint256 value, uint256 modulus) internal view returns (uint256) {
        if (value == 0) return 0;
        bytes memory input = abi.encode(uint256(32), uint256(32), uint256(32), value, modulus - 2, modulus);
        (bool success, bytes memory result) = MODEXP.staticcall(input);
        require(success && result.length == 32, "P256: inverse");
        return abi.decode(result, (uint256));
    }

    function _sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return addmod(a, P - (b % P), P);
    }
}

contract PopularConsensusPaymaster {
    address public immutable entryPoint;
    address public owner;
    mapping(address => bool) public sponsoredSenders;

    event SponsorSet(address indexed sender, bool sponsored);
    event PaymasterValidated(address indexed sender, bytes32 indexed userOpHash);
    event PaymasterPostOp(address indexed sender, bytes32 indexed userOpHash, IPaymaster.PostOpMode mode);

    modifier onlyOwner() {
        require(msg.sender == owner, "Paymaster: owner");
        _;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "Paymaster: entry point");
        _;
    }

    constructor(address entryPoint_) payable {
        require(entryPoint_ != address(0), "Paymaster: entry point");
        entryPoint = entryPoint_;
        owner = msg.sender;
    }

    receive() external payable {}

    function setSponsoredSender(address sender, bool sponsored) external onlyOwner {
        require(sender != address(0), "Paymaster: sender");
        sponsoredSenders[sender] = sponsored;
        emit SponsorSet(sender, sponsored);
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        if (!sponsoredSenders[userOp.sender]) return ("", 1);
        emit PaymasterValidated(userOp.sender, userOpHash);
        return (abi.encode(userOp.sender, userOpHash), 0);
    }

    function postOp(IPaymaster.PostOpMode mode, bytes calldata context, uint256, uint256) external onlyEntryPoint {
        (address sender, bytes32 userOpHash) = abi.decode(context, (address, bytes32));
        emit PaymasterPostOp(sender, userOpHash, mode);
    }
}
