// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ProtocolAccess } from "./ProtocolAccess.sol";

contract AdoptionRegistry is ProtocolAccess {
    enum PolicyStatus {
        Proposed,
        Active,
        Suspended,
        Superseded
    }

    struct AdoptionPolicy {
        bytes32 communityId;
        string authorityLevel;
        bytes32 quorumRuleHash;
        bytes32 approvalRuleHash;
        bytes32 legalHandoffHash;
        bytes32 forkRuleHash;
        PolicyStatus status;
        bytes32 suspensionReasonHash;
    }

    struct GovernanceParameters {
        bytes32 communityId;
        bytes32 parameterSetHash;
        bool active;
    }

    uint256 public nextPolicyId = 1;
    uint256 public nextParameterSetId = 1;
    mapping(uint256 => AdoptionPolicy) public policies;
    mapping(bytes32 => uint256) public activePolicyByCommunity;
    mapping(uint256 => GovernanceParameters) public governanceParameters;
    mapping(bytes32 => uint256) public activeParameterSetByCommunity;
    mapping(bytes32 => bool) public emergencySuspended;
    mapping(bytes32 => bytes32) public emergencyReasonHashByCommunity;

    event AdoptionPolicySet(bytes32 indexed communityId, string authorityLevel);
    event AdoptionPolicyProposed(uint256 indexed policyId, bytes32 indexed communityId, string authorityLevel, bytes32 proposalHash);
    event AdoptionPolicyActivated(uint256 indexed policyId, bytes32 indexed communityId, bytes32 activationHash);
    event AdoptionPolicySuspended(uint256 indexed policyId, bytes32 indexed communityId, bytes32 suspensionReasonHash);
    event GovernanceParametersProposed(uint256 indexed parameterSetId, bytes32 indexed communityId, bytes32 parameterSetHash);
    event GovernanceParametersActivated(uint256 indexed parameterSetId, bytes32 indexed communityId, bytes32 activationHash);
    event CommunityEmergencySuspended(bytes32 indexed communityId, bytes32 emergencyReasonHash);
    event CommunityEmergencyResolved(bytes32 indexed communityId, bytes32 emergencyResolutionHash);

    function moduleId() external pure returns (string memory) {
        return "AdoptionRegistry";
    }

    function proposePolicy(
        bytes32 communityId,
        string calldata newAuthorityLevel,
        bytes32 quorumRuleHash,
        bytes32 approvalRuleHash,
        bytes32 legalHandoffHash,
        bytes32 forkRuleHash,
        bytes32 proposalHash
    ) public returns (uint256 policyId) {
        require(communityId != bytes32(0), "Adoption: community");
        policyId = nextPolicyId++;
        policies[policyId] = AdoptionPolicy({
            communityId: communityId,
            authorityLevel: newAuthorityLevel,
            quorumRuleHash: quorumRuleHash,
            approvalRuleHash: approvalRuleHash,
            legalHandoffHash: legalHandoffHash,
            forkRuleHash: forkRuleHash,
            status: PolicyStatus.Proposed,
            suspensionReasonHash: bytes32(0)
        });
        emit AdoptionPolicyProposed(policyId, communityId, newAuthorityLevel, proposalHash);
    }

    function activatePolicy(uint256 policyId, bytes32 activationHash) public onlySteward {
        AdoptionPolicy storage policy = policies[policyId];
        require(policy.communityId != bytes32(0), "Adoption: policy");
        require(policy.status == PolicyStatus.Proposed, "Adoption: status");
        uint256 previousPolicyId = activePolicyByCommunity[policy.communityId];
        if (previousPolicyId != 0) {
            policies[previousPolicyId].status = PolicyStatus.Superseded;
        }
        policy.status = PolicyStatus.Active;
        activePolicyByCommunity[policy.communityId] = policyId;
        emit AdoptionPolicyActivated(policyId, policy.communityId, activationHash);
        emit AdoptionPolicySet(policy.communityId, policy.authorityLevel);
    }

    function suspendPolicy(uint256 policyId, bytes32 suspensionReasonHash) external onlySteward {
        AdoptionPolicy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Active, "Adoption: active");
        policy.status = PolicyStatus.Suspended;
        policy.suspensionReasonHash = suspensionReasonHash;
        if (activePolicyByCommunity[policy.communityId] == policyId) {
            activePolicyByCommunity[policy.communityId] = 0;
        }
        emit AdoptionPolicySuspended(policyId, policy.communityId, suspensionReasonHash);
    }

    function setPolicy(bytes32 communityId, string calldata newAuthorityLevel) external onlySteward {
        uint256 policyId = proposePolicy(
            communityId,
            newAuthorityLevel,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            keccak256(abi.encode(communityId, newAuthorityLevel))
        );
        activatePolicy(policyId, keccak256(abi.encode(policyId, newAuthorityLevel)));
    }

    function proposeGovernanceParameters(bytes32 communityId, bytes32 parameterSetHash) external returns (uint256 parameterSetId) {
        require(communityId != bytes32(0), "Adoption: community");
        require(parameterSetHash != bytes32(0), "Adoption: parameters");
        parameterSetId = nextParameterSetId++;
        governanceParameters[parameterSetId] = GovernanceParameters({ communityId: communityId, parameterSetHash: parameterSetHash, active: false });
        emit GovernanceParametersProposed(parameterSetId, communityId, parameterSetHash);
    }

    function activateGovernanceParameters(uint256 parameterSetId, bytes32 activationHash) external onlySteward {
        GovernanceParameters storage parameters = governanceParameters[parameterSetId];
        require(parameters.communityId != bytes32(0), "Adoption: parameters");
        parameters.active = true;
        activeParameterSetByCommunity[parameters.communityId] = parameterSetId;
        emit GovernanceParametersActivated(parameterSetId, parameters.communityId, activationHash);
    }

    function suspendCommunity(bytes32 communityId, bytes32 emergencyReasonHash) external onlySteward {
        require(communityId != bytes32(0), "Adoption: community");
        emergencySuspended[communityId] = true;
        emergencyReasonHashByCommunity[communityId] = emergencyReasonHash;
        emit CommunityEmergencySuspended(communityId, emergencyReasonHash);
    }

    function resolveCommunitySuspension(bytes32 communityId, bytes32 emergencyResolutionHash) external onlySteward {
        require(emergencySuspended[communityId], "Adoption: not suspended");
        emergencySuspended[communityId] = false;
        emit CommunityEmergencyResolved(communityId, emergencyResolutionHash);
    }

    function authorityLevel(bytes32 communityId) external view returns (string memory) {
        uint256 policyId = activePolicyByCommunity[communityId];
        if (policyId == 0 || policies[policyId].status != PolicyStatus.Active) {
            return "Advisory";
        }
        return policies[policyId].authorityLevel;
    }
}
