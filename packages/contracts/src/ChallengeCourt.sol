// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ProtocolAccess } from "./ProtocolAccess.sol";

contract ChallengeCourt is ProtocolAccess {
    enum Ruling {
        Pending,
        Sustained,
        Rejected,
        Remanded
    }

    struct Challenge {
        bytes32 targetId;
        string reasonCode;
        bytes32 evidenceHash;
        address challenger;
        uint256 challengeBondId;
        Ruling ruling;
        bytes32 resolutionHash;
    }

    struct JurorAssignment {
        bytes32 targetId;
        address juror;
        bytes32 selectionHash;
        bool conflictDisclosed;
        bytes32 conflictDisclosureHash;
    }

    struct Appeal {
        bytes32 targetId;
        uint256 challengeId;
        bytes32 appealHash;
        address appellant;
        Ruling ruling;
        bytes32 resolutionHash;
        bool resultChallenge;
    }

    uint256 public nextChallengeId = 1;
    uint256 public nextResultChallengeId = 1;
    uint256 public nextAssignmentId = 1;
    uint256 public nextAppealId = 1;
    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => Challenge) public resultChallenges;
    mapping(uint256 => JurorAssignment) public jurorAssignments;
    mapping(uint256 => Appeal) public appeals;

    event ChallengeOpened(uint256 indexed challengeId, bytes32 indexed targetId, string reasonCode);
    event ResultChallenged(uint256 indexed resultChallengeId, bytes32 indexed targetId, string reasonCode);
    event JurorSelected(uint256 indexed assignmentId, bytes32 indexed targetId, address indexed juror, bytes32 selectionHash);
    event JurorConflictDisclosed(uint256 indexed assignmentId, bytes32 conflictDisclosureHash);
    event ChallengeRuled(uint256 indexed challengeId, Ruling ruling, bytes32 resolutionHash);
    event ResultChallengeRuled(uint256 indexed resultChallengeId, Ruling ruling, bytes32 resolutionHash);
    event ChallengeAppealed(uint256 indexed appealId, uint256 indexed challengeId, bytes32 appealHash);
    event ResultChallengeAppealed(uint256 indexed appealId, uint256 indexed resultChallengeId, bytes32 appealHash);
    event ChallengeAppealRuled(uint256 indexed appealId, Ruling ruling, bytes32 resolutionHash);

    function moduleId() external pure returns (string memory) {
        return "ChallengeCourt";
    }

    function openChallenge(
        bytes32 targetId,
        string calldata reasonCode,
        bytes32 evidenceHash,
        uint256 challengeBondId
    ) external returns (uint256 challengeId) {
        challengeId = nextChallengeId++;
        challenges[challengeId] = Challenge({
            targetId: targetId,
            reasonCode: reasonCode,
            evidenceHash: evidenceHash,
            challenger: msg.sender,
            challengeBondId: challengeBondId,
            ruling: Ruling.Pending,
            resolutionHash: bytes32(0)
        });
        emit ChallengeOpened(challengeId, targetId, reasonCode);
    }

    function openResultChallenge(
        bytes32 targetId,
        string calldata reasonCode,
        bytes32 evidenceHash,
        uint256 challengeBondId
    ) external returns (uint256 resultChallengeId) {
        resultChallengeId = nextResultChallengeId++;
        resultChallenges[resultChallengeId] = Challenge({
            targetId: targetId,
            reasonCode: reasonCode,
            evidenceHash: evidenceHash,
            challenger: msg.sender,
            challengeBondId: challengeBondId,
            ruling: Ruling.Pending,
            resolutionHash: bytes32(0)
        });
        emit ResultChallenged(resultChallengeId, targetId, reasonCode);
    }

    function selectJuror(bytes32 targetId, address juror, bytes32 selectionHash) external onlySteward returns (uint256 assignmentId) {
        require(juror != address(0), "Challenge: juror");
        assignmentId = nextAssignmentId++;
        jurorAssignments[assignmentId] = JurorAssignment({
            targetId: targetId,
            juror: juror,
            selectionHash: selectionHash,
            conflictDisclosed: false,
            conflictDisclosureHash: bytes32(0)
        });
        emit JurorSelected(assignmentId, targetId, juror, selectionHash);
    }

    function discloseConflict(uint256 assignmentId, bytes32 conflictDisclosureHash) external {
        JurorAssignment storage assignment = jurorAssignments[assignmentId];
        require(assignment.juror != address(0), "Challenge: assignment");
        require(msg.sender == assignment.juror, "Challenge: juror");
        assignment.conflictDisclosed = true;
        assignment.conflictDisclosureHash = conflictDisclosureHash;
        emit JurorConflictDisclosed(assignmentId, conflictDisclosureHash);
    }

    function rule(uint256 challengeId, Ruling ruling, bytes32 resolutionHash) external onlySteward {
        require(challenges[challengeId].challenger != address(0), "Challenge: missing");
        challenges[challengeId].ruling = ruling;
        challenges[challengeId].resolutionHash = resolutionHash;
        emit ChallengeRuled(challengeId, ruling, resolutionHash);
    }

    function ruleResultChallenge(uint256 resultChallengeId, Ruling ruling, bytes32 resolutionHash) external onlySteward {
        require(resultChallenges[resultChallengeId].challenger != address(0), "Challenge: result missing");
        resultChallenges[resultChallengeId].ruling = ruling;
        resultChallenges[resultChallengeId].resolutionHash = resolutionHash;
        emit ResultChallengeRuled(resultChallengeId, ruling, resolutionHash);
    }

    function appealChallenge(uint256 challengeId, bytes32 appealHash) external returns (uint256 appealId) {
        require(challenges[challengeId].challenger != address(0), "Challenge: missing");
        appealId = nextAppealId++;
        appeals[appealId] = Appeal({
            targetId: challenges[challengeId].targetId,
            challengeId: challengeId,
            appealHash: appealHash,
            appellant: msg.sender,
            ruling: Ruling.Pending,
            resolutionHash: bytes32(0),
            resultChallenge: false
        });
        emit ChallengeAppealed(appealId, challengeId, appealHash);
    }

    function appealResultChallenge(uint256 resultChallengeId, bytes32 appealHash) external returns (uint256 appealId) {
        require(resultChallenges[resultChallengeId].challenger != address(0), "Challenge: result missing");
        appealId = nextAppealId++;
        appeals[appealId] = Appeal({
            targetId: resultChallenges[resultChallengeId].targetId,
            challengeId: resultChallengeId,
            appealHash: appealHash,
            appellant: msg.sender,
            ruling: Ruling.Pending,
            resolutionHash: bytes32(0),
            resultChallenge: true
        });
        emit ResultChallengeAppealed(appealId, resultChallengeId, appealHash);
    }

    function ruleAppeal(uint256 appealId, Ruling ruling, bytes32 resolutionHash) external onlySteward {
        require(appeals[appealId].appellant != address(0), "Challenge: appeal missing");
        appeals[appealId].ruling = ruling;
        appeals[appealId].resolutionHash = resolutionHash;
        emit ChallengeAppealRuled(appealId, ruling, resolutionHash);
    }
}
