// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    PackedUserOperation,
    PopularConsensusAccount,
    PopularConsensusAccountFactory,
    PopularConsensusEntryPoint,
    PopularConsensusP256Verifier,
    PopularConsensusPaymaster
} from "../src/AccountAbstraction.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
}

contract AccountExecutionTarget {
    address public lastCaller;
    uint256 public lastValue;
    uint256 public receivedValue;

    event Recorded(address indexed caller, uint256 value, uint256 ethValue);

    function record(uint256 value) external payable {
        lastCaller = msg.sender;
        lastValue = value;
        receivedValue = msg.value;
        emit Recorded(msg.sender, value, msg.value);
    }
}

contract MockP256Verifier {
    bytes32 public acceptedHash;
    bytes32 public acceptedR;
    bytes32 public acceptedS;
    bytes32 public acceptedX;
    bytes32 public acceptedY;

    function setAcceptedSignature(bytes32 hash, bytes32 r, bytes32 s, bytes32 x, bytes32 y) external {
        acceptedHash = hash;
        acceptedR = r;
        acceptedS = s;
        acceptedX = x;
        acceptedY = y;
    }

    fallback(bytes calldata data) external returns (bytes memory) {
        if (data.length != 160) return abi.encode(uint256(0));
        (bytes32 hash, bytes32 r, bytes32 s, bytes32 x, bytes32 y) = abi.decode(data, (bytes32, bytes32, bytes32, bytes32, bytes32));
        bool valid = hash == acceptedHash && r == acceptedR && s == acceptedS && x == acceptedX && y == acceptedY;
        return abi.encode(valid ? uint256(1) : uint256(0));
    }
}

contract AccountAbstractionTest {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant WRONG_KEY = 0xB0B;

    PopularConsensusEntryPoint entryPoint;
    PopularConsensusAccountFactory factory;
    PopularConsensusPaymaster paymaster;
    AccountExecutionTarget target;
    address owner;

    function setUp() public {
        entryPoint = new PopularConsensusEntryPoint();
        factory = new PopularConsensusAccountFactory(address(entryPoint), address(0x100));
        paymaster = new PopularConsensusPaymaster(address(entryPoint));
        target = new AccountExecutionTarget();
        owner = VM.addr(OWNER_KEY);
    }

    function testFactoryPredictsCreate2Address() public {
        bytes32 salt = factory.saltForWallet(owner);
        address predicted = factory.getAddress(owner, bytes32(0), bytes32(0), salt);

        address deployed = factory.createAccount(owner, bytes32(0), bytes32(0), salt);
        require(deployed == predicted, "prediction mismatch");
        require(predicted.code.length > 0, "account not deployed");

        address repeated = factory.createAccount(owner, bytes32(0), bytes32(0), salt);
        require(repeated == predicted, "repeated create changed account");
    }

    function testWalletUserOperationDeploysCounterfactualAccountAndExecutes() public {
        bytes32 salt = factory.saltForWallet(owner);
        address predicted = factory.getAddress(owner, bytes32(0), bytes32(0), salt);
        require(predicted.code.length == 0, "account already deployed");

        PackedUserOperation memory op = _walletOperation(predicted, salt, "");
        op = _signWalletOperation(op, OWNER_KEY);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        entryPoint.handleOps(ops, payable(address(0xBEEF)));

        require(predicted.code.length > 0, "account not deployed");
        require(PopularConsensusAccount(payable(predicted)).nonce() == 1, "nonce not consumed");
        require(target.lastCaller() == predicted, "target caller mismatch");
        require(target.lastValue() == 42, "target value missing");
    }

    function testInvalidWalletSignatureIsRejected() public {
        bytes32 salt = factory.saltForWallet(owner);
        address predicted = factory.getAddress(owner, bytes32(0), bytes32(0), salt);
        PackedUserOperation memory op = _walletOperation(predicted, salt, "");
        op = _signWalletOperation(op, WRONG_KEY);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        try entryPoint.handleOps(ops, payable(address(0xBEEF))) {
            revert("invalid wallet signature accepted");
        } catch {}
    }

    function testPaymasterSponsorsWalletUserOperation() public {
        bytes32 salt = factory.saltForWallet(owner);
        address predicted = factory.getAddress(owner, bytes32(0), bytes32(0), salt);
        paymaster.setSponsoredSender(predicted, true);

        PackedUserOperation memory op = _walletOperation(predicted, salt, abi.encodePacked(address(paymaster), bytes("pc-sponsored")));
        op = _signWalletOperation(op, OWNER_KEY);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        entryPoint.handleOps(ops, payable(address(0xBEEF)));

        require(target.lastCaller() == predicted, "sponsored call missing");
        require(target.lastValue() == 42, "sponsored value missing");
    }

    function testPasskeyUserOperationUsesP256Verifier() public {
        MockP256Verifier verifier = new MockP256Verifier();
        PopularConsensusAccountFactory passkeyFactory = new PopularConsensusAccountFactory(address(entryPoint), address(verifier));
        bytes32 passkeyX = bytes32(uint256(0x1234));
        bytes32 passkeyY = bytes32(uint256(0x5678));
        bytes32 signatureR = bytes32(uint256(0xABCD));
        bytes32 signatureS = bytes32(uint256(0xEF01));
        bytes32 salt = passkeyFactory.saltForPasskey(keccak256("passkey-credential"));
        address predicted = passkeyFactory.getAddress(address(0), passkeyX, passkeyY, salt);

        PackedUserOperation memory op = _passkeyOperation(passkeyFactory, predicted, passkeyX, passkeyY, salt);
        op = _signPasskeyOperation(op, verifier, signatureR, signatureS, passkeyX, passkeyY);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        entryPoint.handleOps(ops, payable(address(0xBEEF)));

        require(predicted.code.length > 0, "passkey account not deployed");
        require(target.lastCaller() == predicted, "passkey target caller mismatch");
        require(target.lastValue() == 42, "passkey value missing");
    }

    function testInvalidPasskeySignatureIsRejected() public {
        MockP256Verifier verifier = new MockP256Verifier();
        PopularConsensusAccountFactory passkeyFactory = new PopularConsensusAccountFactory(address(entryPoint), address(verifier));
        bytes32 passkeyX = bytes32(uint256(0x1234));
        bytes32 passkeyY = bytes32(uint256(0x5678));
        bytes32 salt = passkeyFactory.saltForPasskey(keccak256("passkey-credential"));
        address predicted = passkeyFactory.getAddress(address(0), passkeyX, passkeyY, salt);

        PackedUserOperation memory op = _passkeyOperation(passkeyFactory, predicted, passkeyX, passkeyY, salt);
        op = _signPasskeyOperation(
            op,
            verifier,
            bytes32(uint256(0xABCD)),
            bytes32(uint256(0xEF01)),
            passkeyX,
            passkeyY
        );
        verifier.setAcceptedSignature(bytes32(0), bytes32(0), bytes32(0), passkeyX, passkeyY);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        try entryPoint.handleOps(ops, payable(address(0xBEEF))) {
            revert("invalid passkey signature accepted");
        } catch {}
    }

    function testLocalP256VerifierAcceptsRealFixture() public {
        PopularConsensusP256Verifier verifier = new PopularConsensusP256Verifier();
        bytes32 digest = 0x95c19e5e91bcde29b409b49ed0522d0d5bbcfe0f6d8b25e73730f569d36529bc;
        bytes32 r = 0xb9f55e39356ff73065c120f9a3f14f68d358fabd39d7beca3bbb31eccd60cbde;
        bytes32 s = 0x2f4be78a7279ea186647aeaa94c3d6cfd37ed84485b908c89cfd0d03c26c2d82;
        bytes32 x = 0x4ee56cbabe6251668945ef5cf5cb58b695f5ca4ca49dc8b6f2fe624d6962ddaf;
        bytes32 y = 0x234fbdf6acaf0b7cb45c184e9dd81cd2bc43c75dd1cefcc80c716b5930e1867a;

        require(verifier.verify(digest, r, s, x, y), "fixture signature rejected");

        (bool success, bytes memory result) = address(verifier).staticcall(abi.encode(digest, r, s, x, y));
        require(success, "fallback call failed");
        require(abi.decode(result, (uint256)) == 1, "fallback signature rejected");

        require(!verifier.verify(digest, r, bytes32(uint256(s) + 1), x, y), "invalid signature accepted");
    }

    function _walletOperation(address sender, bytes32 salt, bytes memory paymasterAndData) internal view returns (PackedUserOperation memory) {
        bytes memory initCode = abi.encodePacked(
            address(factory),
            abi.encodeCall(PopularConsensusAccountFactory.createAccount, (owner, bytes32(0), bytes32(0), salt))
        );
        return _operation(sender, initCode, paymasterAndData);
    }

    function _passkeyOperation(
        PopularConsensusAccountFactory passkeyFactory,
        address sender,
        bytes32 passkeyX,
        bytes32 passkeyY,
        bytes32 salt
    ) internal view returns (PackedUserOperation memory) {
        bytes memory initCode = abi.encodePacked(
            address(passkeyFactory),
            abi.encodeCall(PopularConsensusAccountFactory.createAccount, (address(0), passkeyX, passkeyY, salt))
        );
        return _operation(sender, initCode, "");
    }

    function _operation(address sender, bytes memory initCode, bytes memory paymasterAndData) internal view returns (PackedUserOperation memory) {
        return PackedUserOperation({
            sender: sender,
            nonce: 0,
            initCode: initCode,
            callData: abi.encodeCall(
                PopularConsensusAccount.execute,
                (address(target), 0, abi.encodeCall(AccountExecutionTarget.record, (42)))
            ),
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: paymasterAndData,
            signature: ""
        });
    }

    function _signWalletOperation(PackedUserOperation memory op, uint256 privateKey) internal returns (PackedUserOperation memory) {
        bytes32 userOpHash = entryPoint.getUserOpHash(op);
        bytes32 walletHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));
        (uint8 v, bytes32 r, bytes32 s) = VM.sign(privateKey, walletHash);
        op.signature = abi.encodePacked(bytes1(uint8(0)), r, s, v);
        return op;
    }

    function _signPasskeyOperation(
        PackedUserOperation memory op,
        MockP256Verifier verifier,
        bytes32 signatureR,
        bytes32 signatureS,
        bytes32 passkeyX,
        bytes32 passkeyY
    ) internal returns (PackedUserOperation memory) {
        bytes32 userOpHash = entryPoint.getUserOpHash(op);
        bytes memory authenticatorData = abi.encodePacked(bytes32(keccak256("popular-consensus.test")), bytes1(uint8(0x05)), uint32(2));
        bytes memory prefix = bytes("{\"type\":\"webauthn.get\",\"challenge\":\"");
        bytes memory clientDataJSON = abi.encodePacked(
            prefix,
            _base64UrlEncode32(userOpHash),
            bytes("\",\"origin\":\"http://127.0.0.1:3002\"}")
        );
        bytes32 webAuthnHash = sha256(abi.encodePacked(authenticatorData, sha256(clientDataJSON)));
        verifier.setAcceptedSignature(webAuthnHash, signatureR, signatureS, passkeyX, passkeyY);
        op.signature = abi.encodePacked(
            bytes1(uint8(1)),
            abi.encode(authenticatorData, clientDataJSON, prefix.length, signatureR, signatureS)
        );
        return op;
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
}
