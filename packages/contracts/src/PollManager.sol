// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ProtocolAccess } from "./ProtocolAccess.sol";

contract PollManager is ProtocolAccess {
    enum PollStatus {
        Configured,
        Open,
        Closed,
        ResultPublished
    }

    struct Poll {
        bytes32 questionId;
        bytes32 credentialSchemaId;
        bytes32 tallyPublicKeyId;
        uint256 opensAt;
        uint256 closesAt;
        uint256 acceptedBallots;
        PollStatus status;
    }

    struct Ballot {
        bytes32 ballotCommitment;
        bytes32 nullifier;
        bytes32 encryptedPayloadHash;
        bytes32 proofHash;
        address voter;
    }

    uint256 public nextPollId = 1;
    mapping(uint256 => Poll) public polls;
    mapping(uint256 => Ballot[]) private pollBallots;
    mapping(uint256 => mapping(bytes32 => bool)) public nullifierUsed;

    event PollConfigured(uint256 indexed pollId, bytes32 indexed questionId, bytes32 credentialSchemaId, bytes32 tallyPublicKeyId);
    event PollOpened(uint256 indexed pollId, bytes32 indexed questionId);
    event BallotAccepted(
        uint256 indexed pollId,
        bytes32 indexed nullifier,
        bytes32 ballotCommitment,
        bytes32 encryptedPayloadHash,
        bytes32 proofHash
    );
    event PollClosed(uint256 indexed pollId);
    event PollStatusChanged(uint256 indexed pollId, PollStatus status);

    function moduleId() external pure returns (string memory) {
        return "PollManager";
    }

    function createPoll(bytes32 questionId, bytes32 credentialSchemaId, bytes32 tallyPublicKeyId) external onlySteward returns (uint256 pollId) {
        return configurePoll(questionId, credentialSchemaId, tallyPublicKeyId, 0, 0);
    }

    function configurePoll(
        bytes32 questionId,
        bytes32 credentialSchemaId,
        bytes32 tallyPublicKeyId,
        uint256 opensAt,
        uint256 closesAt
    ) public onlySteward returns (uint256 pollId) {
        require(questionId != bytes32(0), "Poll: question");
        require(credentialSchemaId != bytes32(0), "Poll: credential schema");
        require(tallyPublicKeyId != bytes32(0), "Poll: tally key");
        pollId = nextPollId++;
        polls[pollId] = Poll({
            questionId: questionId,
            credentialSchemaId: credentialSchemaId,
            tallyPublicKeyId: tallyPublicKeyId,
            opensAt: opensAt,
            closesAt: closesAt,
            acceptedBallots: 0,
            status: PollStatus.Configured
        });
        emit PollConfigured(pollId, questionId, credentialSchemaId, tallyPublicKeyId);
    }

    function setStatus(uint256 pollId, PollStatus status) external onlySteward {
        require(polls[pollId].questionId != bytes32(0), "Poll: missing");
        polls[pollId].status = status;
        emit PollStatusChanged(pollId, status);
    }

    function openPoll(uint256 pollId) external onlySteward {
        Poll storage poll = polls[pollId];
        require(poll.questionId != bytes32(0), "Poll: missing");
        require(poll.status == PollStatus.Configured, "Poll: status");
        poll.status = PollStatus.Open;
        emit PollOpened(pollId, poll.questionId);
        emit PollStatusChanged(pollId, PollStatus.Open);
    }

    function submitBallot(
        uint256 pollId,
        bytes32 nullifier,
        bytes32 ballotCommitment,
        bytes32 encryptedPayloadHash,
        bytes32 proofHash
    ) external {
        Poll storage poll = polls[pollId];
        require(poll.status == PollStatus.Open, "Poll: not open");
        require(nullifier != bytes32(0), "Poll: nullifier");
        require(ballotCommitment != bytes32(0), "Poll: commitment");
        require(!nullifierUsed[pollId][nullifier], "Poll: duplicate nullifier");
        nullifierUsed[pollId][nullifier] = true;
        poll.acceptedBallots += 1;
        pollBallots[pollId].push(
            Ballot({
                ballotCommitment: ballotCommitment,
                nullifier: nullifier,
                encryptedPayloadHash: encryptedPayloadHash,
                proofHash: proofHash,
                voter: msg.sender
            })
        );
        emit BallotAccepted(pollId, nullifier, ballotCommitment, encryptedPayloadHash, proofHash);
    }

    function closePoll(uint256 pollId) external onlySteward {
        Poll storage poll = polls[pollId];
        require(poll.status == PollStatus.Open, "Poll: not open");
        poll.status = PollStatus.Closed;
        emit PollClosed(pollId);
        emit PollStatusChanged(pollId, PollStatus.Closed);
    }

    function markResultPublished(uint256 pollId) external onlySteward {
        Poll storage poll = polls[pollId];
        require(poll.status == PollStatus.Closed, "Poll: not closed");
        poll.status = PollStatus.ResultPublished;
        emit PollStatusChanged(pollId, PollStatus.ResultPublished);
    }

    function ballotCount(uint256 pollId) external view returns (uint256) {
        return pollBallots[pollId].length;
    }

    function ballotAt(uint256 pollId, uint256 index) external view returns (Ballot memory) {
        return pollBallots[pollId][index];
    }
}

contract PollAdapter is PollManager {
}
