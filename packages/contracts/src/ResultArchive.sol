// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ProtocolAccess } from "./ProtocolAccess.sol";

contract ResultArchive is ProtocolAccess {
    enum FinalStatus {
        Published,
        Corrected,
        Finalized,
        Archived
    }

    struct Result {
        bytes32 artifactHash;
        bytes32 aggregateCountsHash;
        bytes32 tallyProofHash;
        bytes32 tallyPublicationProofHash;
        bytes32 privacyReportHash;
        uint256 turnout;
        uint256 invalidBallots;
        uint256 challengeWindowEndsAt;
        FinalStatus status;
    }

    struct Archive {
        bytes32 questionId;
        bytes32 archiveHash;
        bytes32 artifactManifestHash;
        address archivedBy;
    }

    mapping(uint256 => Result) public results;
    mapping(bytes32 => Archive) public archives;

    event ResultPublished(
        uint256 indexed pollId,
        bytes32 artifactHash,
        bytes32 aggregateCountsHash,
        bytes32 tallyProofHash,
        bytes32 tallyPublicationProofHash,
        uint256 turnout,
        uint256 invalidBallots
    );
    event ResultCorrected(uint256 indexed pollId, bytes32 correctedArtifactHash, bytes32 correctionHash);
    event ResultFinalized(uint256 indexed pollId);
    event QuestionArchived(bytes32 indexed questionId, bytes32 archiveHash, bytes32 artifactManifestHash, address archivedBy);

    function moduleId() external pure returns (string memory) {
        return "ResultArchive";
    }

    function publishResult(uint256 pollId, bytes32 artifactHash, bytes32 tallyProofHash, uint256 turnout, uint256 challengeWindowEndsAt) external onlySteward {
        publishResultWithProof(pollId, artifactHash, bytes32(0), tallyProofHash, bytes32(0), bytes32(0), turnout, 0, challengeWindowEndsAt);
    }

    function publishResultWithProof(
        uint256 pollId,
        bytes32 artifactHash,
        bytes32 aggregateCountsHash,
        bytes32 tallyProofHash,
        bytes32 tallyPublicationProofHash,
        bytes32 privacyReportHash,
        uint256 turnout,
        uint256 invalidBallots,
        uint256 challengeWindowEndsAt
    ) public onlySteward {
        require(artifactHash != bytes32(0), "Result: artifact");
        results[pollId] = Result({
            artifactHash: artifactHash,
            aggregateCountsHash: aggregateCountsHash,
            tallyProofHash: tallyProofHash,
            tallyPublicationProofHash: tallyPublicationProofHash,
            privacyReportHash: privacyReportHash,
            turnout: turnout,
            invalidBallots: invalidBallots,
            challengeWindowEndsAt: challengeWindowEndsAt,
            status: FinalStatus.Published
        });
        emit ResultPublished(pollId, artifactHash, aggregateCountsHash, tallyProofHash, tallyPublicationProofHash, turnout, invalidBallots);
    }

    function correctResult(uint256 pollId, bytes32 correctedArtifactHash, bytes32 correctionHash) external onlySteward {
        Result storage result = results[pollId];
        require(result.artifactHash != bytes32(0), "Result: missing");
        require(correctedArtifactHash != bytes32(0), "Result: corrected artifact");
        result.artifactHash = correctedArtifactHash;
        result.status = FinalStatus.Corrected;
        emit ResultCorrected(pollId, correctedArtifactHash, correctionHash);
    }

    function finalizeResult(uint256 pollId) external onlySteward {
        Result storage result = results[pollId];
        require(result.artifactHash != bytes32(0), "Result: missing");
        require(block.timestamp >= result.challengeWindowEndsAt, "Result: challenge window");
        result.status = FinalStatus.Finalized;
        emit ResultFinalized(pollId);
    }

    function archiveQuestion(bytes32 questionId, bytes32 archiveHash, bytes32 artifactManifestHash) external onlySteward {
        require(questionId != bytes32(0), "Archive: question");
        require(archiveHash != bytes32(0), "Archive: hash");
        archives[questionId] = Archive({
            questionId: questionId,
            archiveHash: archiveHash,
            artifactManifestHash: artifactManifestHash,
            archivedBy: msg.sender
        });
        emit QuestionArchived(questionId, archiveHash, artifactManifestHash, msg.sender);
    }
}
