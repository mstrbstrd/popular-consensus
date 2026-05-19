// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ProtocolAccess } from "./ProtocolAccess.sol";

contract TallyManager is ProtocolAccess {
    enum CommitteeStatus {
        Proposed,
        Active,
        Failed
    }

    struct Committee {
        bytes32 communityId;
        bytes32 metadataHash;
        uint256 threshold;
        uint256 memberCount;
        uint256 replacesCommitteeId;
        CommitteeStatus status;
        bytes32 activationHash;
        bytes32 failureHash;
    }

    struct KeySetup {
        uint256 committeeId;
        bytes32 publicKeyId;
        bytes32 setupHash;
        uint256 threshold;
        bool active;
    }

    struct DecryptionShare {
        uint256 pollId;
        uint256 setupId;
        bytes32 memberId;
        bytes32 shareHash;
        bytes32 proofHash;
        address submitter;
    }

    uint256 public nextCommitteeId = 1;
    uint256 public nextSetupId = 1;
    uint256 public nextShareId = 1;
    mapping(uint256 => Committee) public committees;
    mapping(uint256 => KeySetup) public keySetups;
    mapping(uint256 => DecryptionShare) public decryptionShares;
    mapping(uint256 => mapping(uint256 => uint256)) public acceptedShareCountByPollAndSetup;
    mapping(uint256 => mapping(uint256 => mapping(bytes32 => bool))) public memberShareSubmitted;

    event TallyCommitteeProposed(
        uint256 indexed committeeId,
        bytes32 indexed communityId,
        bytes32 metadataHash,
        uint256 threshold,
        uint256 memberCount,
        uint256 replacesCommitteeId
    );
    event TallyCommitteeActivated(uint256 indexed committeeId, bytes32 activationHash);
    event TallyCommitteeFailed(uint256 indexed committeeId, bytes32 failureHash, uint256 replacementCommitteeId);
    event TallyKeySetupPublished(uint256 indexed setupId, uint256 indexed committeeId, bytes32 publicKeyId, bytes32 setupHash);
    event TallyDecryptionShareSubmitted(
        uint256 indexed shareId,
        uint256 indexed pollId,
        uint256 indexed setupId,
        bytes32 memberId,
        bytes32 shareHash,
        bytes32 proofHash
    );
    event ResultPublished(uint256 indexed pollId, uint256 indexed setupId, bytes32 tallyPublicationProofHash, uint256 acceptedShareCount);

    function moduleId() external pure returns (string memory) {
        return "TallyManager";
    }

    function proposeCommittee(
        bytes32 communityId,
        bytes32 metadataHash,
        uint256 threshold,
        uint256 memberCount,
        uint256 replacesCommitteeId
    ) external onlySteward returns (uint256 committeeId) {
        require(communityId != bytes32(0), "Tally: community");
        require(threshold > 0, "Tally: threshold");
        require(memberCount >= threshold, "Tally: member count");
        committeeId = nextCommitteeId++;
        committees[committeeId] = Committee({
            communityId: communityId,
            metadataHash: metadataHash,
            threshold: threshold,
            memberCount: memberCount,
            replacesCommitteeId: replacesCommitteeId,
            status: CommitteeStatus.Proposed,
            activationHash: bytes32(0),
            failureHash: bytes32(0)
        });
        emit TallyCommitteeProposed(committeeId, communityId, metadataHash, threshold, memberCount, replacesCommitteeId);
    }

    function activateCommittee(uint256 committeeId, bytes32 activationHash) external onlySteward {
        Committee storage committee = committees[committeeId];
        require(committee.communityId != bytes32(0), "Tally: committee");
        require(committee.status == CommitteeStatus.Proposed, "Tally: status");
        committee.status = CommitteeStatus.Active;
        committee.activationHash = activationHash;
        emit TallyCommitteeActivated(committeeId, activationHash);
    }

    function failCommittee(uint256 committeeId, bytes32 failureHash, uint256 replacementCommitteeId) external onlySteward {
        Committee storage committee = committees[committeeId];
        require(committee.communityId != bytes32(0), "Tally: committee");
        require(committee.status == CommitteeStatus.Active, "Tally: status");
        committee.status = CommitteeStatus.Failed;
        committee.failureHash = failureHash;
        emit TallyCommitteeFailed(committeeId, failureHash, replacementCommitteeId);
    }

    function publishTallyKey(uint256 committeeId, bytes32 publicKeyId, bytes32 setupHash) external onlySteward returns (uint256 setupId) {
        Committee storage committee = committees[committeeId];
        require(committee.status == CommitteeStatus.Active, "Tally: committee active");
        require(publicKeyId != bytes32(0), "Tally: public key");
        setupId = nextSetupId++;
        keySetups[setupId] = KeySetup({
            committeeId: committeeId,
            publicKeyId: publicKeyId,
            setupHash: setupHash,
            threshold: committee.threshold,
            active: true
        });
        emit TallyKeySetupPublished(setupId, committeeId, publicKeyId, setupHash);
    }

    function submitDecryptionShare(
        uint256 pollId,
        uint256 setupId,
        bytes32 memberId,
        bytes32 shareHash,
        bytes32 proofHash
    ) external returns (uint256 shareId) {
        require(keySetups[setupId].active, "Tally: setup");
        require(memberId != bytes32(0), "Tally: member");
        require(!memberShareSubmitted[pollId][setupId][memberId], "Tally: duplicate share");
        memberShareSubmitted[pollId][setupId][memberId] = true;
        acceptedShareCountByPollAndSetup[pollId][setupId] += 1;
        shareId = nextShareId++;
        decryptionShares[shareId] = DecryptionShare({
            pollId: pollId,
            setupId: setupId,
            memberId: memberId,
            shareHash: shareHash,
            proofHash: proofHash,
            submitter: msg.sender
        });
        emit TallyDecryptionShareSubmitted(shareId, pollId, setupId, memberId, shareHash, proofHash);
    }

    function publishTallyProof(uint256 pollId, uint256 setupId, bytes32 tallyPublicationProofHash) external onlySteward {
        KeySetup storage setup = keySetups[setupId];
        require(setup.active, "Tally: setup");
        uint256 acceptedShareCount = acceptedShareCountByPollAndSetup[pollId][setupId];
        require(acceptedShareCount >= setup.threshold, "Tally: threshold");
        emit ResultPublished(pollId, setupId, tallyPublicationProofHash, acceptedShareCount);
    }
}
