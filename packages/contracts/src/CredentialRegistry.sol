// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ProtocolAccess } from "./ProtocolAccess.sol";

contract CredentialRegistry is ProtocolAccess {
    mapping(bytes32 => bool) public activeSchemas;
    mapping(bytes32 => bool) public activeIssuers;
    mapping(bytes32 => bytes32) public revocationRootBySchema;
    mapping(bytes32 => bytes32) public trustPolicyByCommunity;

    event CredentialSchemaRegistered(bytes32 indexed schemaId);
    event CredentialIssuerRegistered(bytes32 indexed issuerId, bytes32 indexed schemaId);
    event CredentialIssuerSuspended(bytes32 indexed issuerId, bytes32 suspensionHash);
    event CredentialRevocationRootUpdated(bytes32 indexed schemaId, bytes32 revocationRoot);
    event CommunityCredentialTrustPolicySet(bytes32 indexed communityId, bytes32 trustPolicyHash);

    function moduleId() external pure returns (string memory) {
        return "CredentialRegistry";
    }

    function registerSchema(bytes32 schemaId) external onlySteward {
        activeSchemas[schemaId] = true;
        emit CredentialSchemaRegistered(schemaId);
    }

    function registerIssuer(bytes32 issuerId, bytes32 schemaId) external onlySteward {
        require(activeSchemas[schemaId], "Credential: schema");
        activeIssuers[issuerId] = true;
        emit CredentialIssuerRegistered(issuerId, schemaId);
    }

    function suspendIssuer(bytes32 issuerId, bytes32 suspensionHash) external onlySteward {
        require(activeIssuers[issuerId], "Credential: issuer");
        activeIssuers[issuerId] = false;
        emit CredentialIssuerSuspended(issuerId, suspensionHash);
    }

    function updateRevocationRoot(bytes32 schemaId, bytes32 revocationRoot) external onlySteward {
        require(activeSchemas[schemaId], "Credential: schema");
        revocationRootBySchema[schemaId] = revocationRoot;
        emit CredentialRevocationRootUpdated(schemaId, revocationRoot);
    }

    function setTrustPolicy(bytes32 communityId, bytes32 trustPolicyHash) external onlySteward {
        trustPolicyByCommunity[communityId] = trustPolicyHash;
        emit CommunityCredentialTrustPolicySet(communityId, trustPolicyHash);
    }
}
