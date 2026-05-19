// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ProtocolAccess } from "./ProtocolAccess.sol";

contract QuestionRegistry is ProtocolAccess {
    enum Status {
        Drafted,
        Submitted,
        Challenged,
        Amendment,
        Rejected,
        Accepted,
        Open,
        Closed,
        ResultPublished,
        ResultChallenged,
        Corrected,
        Finalized,
        Archived
    }

    struct Question {
        bytes32 versionHash;
        uint256 version;
        address proposer;
        uint256 proposalBondId;
        Status status;
        string authorityLevel;
        string methodologyLabel;
        bytes32 archiveHash;
    }

    mapping(bytes32 => Question) public questions;

    event QuestionSubmitted(bytes32 indexed questionId, bytes32 versionHash, address indexed proposer, uint256 bondId);
    event QuestionStatusChanged(bytes32 indexed questionId, Status status);
    event QuestionAmended(bytes32 indexed questionId, bytes32 versionHash, uint256 version);
    event QuestionAccepted(bytes32 indexed questionId, address indexed curator);
    event QuestionRejected(bytes32 indexed questionId, bytes32 reasonHash);
    event QuestionArchived(bytes32 indexed questionId, bytes32 archiveHash);
    event CommunityForked(bytes32 indexed sourceCommunityId, bytes32 indexed forkCommunityId, bytes32 forkHash);

    function moduleId() external pure returns (string memory) {
        return "QuestionRegistry";
    }

    function submitQuestion(
        bytes32 questionId,
        bytes32 versionHash,
        uint256 proposalBondId,
        string calldata methodologyLabel
    ) external {
        require(questions[questionId].version == 0, "Question: exists");
        questions[questionId] = Question({
            versionHash: versionHash,
            version: 1,
            proposer: msg.sender,
            proposalBondId: proposalBondId,
            status: Status.Submitted,
            authorityLevel: "Advisory",
            methodologyLabel: methodologyLabel,
            archiveHash: bytes32(0)
        });
        emit QuestionSubmitted(questionId, versionHash, msg.sender, proposalBondId);
    }

    function setStatus(bytes32 questionId, Status status) external onlySteward {
        require(questions[questionId].version > 0, "Question: missing");
        questions[questionId].status = status;
        emit QuestionStatusChanged(questionId, status);
    }

    function accept(bytes32 questionId) external onlySteward {
        require(questions[questionId].version > 0, "Question: missing");
        questions[questionId].status = Status.Accepted;
        emit QuestionAccepted(questionId, msg.sender);
        emit QuestionStatusChanged(questionId, Status.Accepted);
    }

    function reject(bytes32 questionId, bytes32 reasonHash) external onlySteward {
        require(questions[questionId].version > 0, "Question: missing");
        questions[questionId].status = Status.Rejected;
        emit QuestionRejected(questionId, reasonHash);
        emit QuestionStatusChanged(questionId, Status.Rejected);
    }

    function amend(bytes32 questionId, bytes32 newVersionHash) external {
        Question storage question = questions[questionId];
        require(question.version > 0, "Question: missing");
        require(msg.sender == question.proposer, "Question: proposer");
        question.version += 1;
        question.versionHash = newVersionHash;
        question.status = Status.Amendment;
        emit QuestionAmended(questionId, newVersionHash, question.version);
    }

    function archive(bytes32 questionId, bytes32 archiveHash) external onlySteward {
        Question storage question = questions[questionId];
        require(question.version > 0, "Question: missing");
        question.status = Status.Archived;
        question.archiveHash = archiveHash;
        emit QuestionArchived(questionId, archiveHash);
        emit QuestionStatusChanged(questionId, Status.Archived);
    }

    function recordFork(bytes32 sourceCommunityId, bytes32 forkCommunityId, bytes32 forkHash) external {
        require(sourceCommunityId != bytes32(0), "Question: source community");
        require(forkCommunityId != bytes32(0), "Question: fork community");
        emit CommunityForked(sourceCommunityId, forkCommunityId, forkHash);
    }
}
