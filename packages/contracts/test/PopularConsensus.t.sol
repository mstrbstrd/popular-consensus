// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    AdoptionRegistry,
    ChallengeCourt,
    CredentialRegistry,
    PCToken,
    PollManager,
    QuestionRegistry,
    ResultArchive,
    StakeManager,
    TallyManager
} from "../src/PopularConsensus.sol";

contract PopularConsensusTest {
    bytes32 constant Q1 = keccak256("q1");
    bytes32 constant C1 = keccak256("c1");
    bytes32 constant V1 = keccak256("v1");
    bytes32 constant V2 = keccak256("v2");
    bytes32 constant RESIDENT = keccak256("resident");
    bytes32 constant ISSUER = keccak256("issuer");
    bytes32 constant TALLY_KEY = keccak256("tally-key");
    bytes32 constant ARTIFACT = keccak256("artifact");
    bytes32 constant CORRECTED = keccak256("corrected");
    bytes32 constant PROOF = keccak256("proof");
    bytes32 constant SHARE_1 = keccak256("share-1");
    bytes32 constant SHARE_2 = keccak256("share-2");
    bytes32 constant MEMBER_1 = keccak256("member-1");
    bytes32 constant MEMBER_2 = keccak256("member-2");
    bytes32 constant VANCOUVER = keccak256("vancouver");

    PCToken pc;
    StakeManager stake;
    QuestionRegistry questions;
    ChallengeCourt challenges;
    CredentialRegistry credentials;
    PollManager polls;
    TallyManager tallies;
    ResultArchive results;
    AdoptionRegistry adoption;

    function setUp() public {
        pc = new PCToken(1_000_000 ether);
        stake = new StakeManager(pc, address(0xBEEF));
        questions = new QuestionRegistry();
        challenges = new ChallengeCourt();
        credentials = new CredentialRegistry();
        polls = new PollManager();
        tallies = new TallyManager();
        results = new ResultArchive();
        adoption = new AdoptionRegistry();
        pc.approve(address(stake), type(uint256).max);
    }

    function testProposalStakeEscrowAndRefund() public {
        uint256 bondId = stake.escrowProposal(Q1, 100 ether);
        require(pc.balanceOf(address(stake)) == 100 ether, "escrow missing");
        stake.refund(bondId);
        require(pc.balanceOf(address(stake)) == 0, "refund missing");
    }

    function testChallengeBondSlash() public {
        uint256 bondId = stake.escrowChallenge(Q1, C1, 50 ether);
        stake.slash(bondId, 10_000);
        require(pc.balanceOf(address(0xBEEF)) == 50 ether, "slash missing");
    }

    function testQuestionLifecycleAndAmendment() public {
        uint256 bondId = stake.escrowProposal(Q1, 100 ether);
        questions.submitQuestion(Q1, V1, bondId, "Verified resident response, self-selected sample");
        questions.accept(Q1);
        questions.amend(Q1, V2);
        (, uint256 version,,,,,,) = questions.questions(Q1);
        require(version == 2, "version not preserved");
    }

    function testCredentialIssuerRegistration() public {
        credentials.registerSchema(RESIDENT);
        credentials.registerIssuer(ISSUER, RESIDENT);
        require(credentials.activeIssuers(ISSUER), "issuer inactive");
    }

    function testPollManagerBallotNullifier() public {
        uint256 pollId = polls.createPoll(Q1, RESIDENT, TALLY_KEY);
        polls.openPoll(pollId);
        polls.submitBallot(pollId, keccak256("nullifier"), keccak256("ballot"), keccak256("payload"), PROOF);
        try polls.submitBallot(pollId, keccak256("nullifier"), keccak256("ballot-2"), keccak256("payload-2"), PROOF) {
            revert("duplicate nullifier accepted");
        } catch {}
        (,,,,,, PollManager.PollStatus status) = polls.polls(pollId);
        require(status == PollManager.PollStatus.Open, "poll not open");
        require(polls.ballotCount(pollId) == 1, "ballot missing");
        polls.closePoll(pollId);
    }

    function testTallyManagerThresholdProof() public {
        uint256 committeeId = tallies.proposeCommittee(VANCOUVER, keccak256("metadata"), 2, 3, 0);
        tallies.activateCommittee(committeeId, keccak256("activation"));
        uint256 setupId = tallies.publishTallyKey(committeeId, TALLY_KEY, keccak256("setup"));
        tallies.submitDecryptionShare(1, setupId, MEMBER_1, SHARE_1, keccak256("proof-1"));
        try tallies.publishTallyProof(1, setupId, PROOF) {
            revert("proof published before threshold");
        } catch {}
        tallies.submitDecryptionShare(1, setupId, MEMBER_2, SHARE_2, keccak256("proof-2"));
        tallies.publishTallyProof(1, setupId, PROOF);
        require(tallies.acceptedShareCountByPollAndSetup(1, setupId) == 2, "shares missing");
    }

    function testResultArchiveCannotFinalizeDuringWindow() public {
        results.publishResult(1, ARTIFACT, PROOF, 10, block.timestamp + 1 days);
        try results.finalizeResult(1) {
            revert("finalized too early");
        } catch {}
    }

    function testResultArchiveCorrectionAndArchive() public {
        results.publishResultWithProof(1, ARTIFACT, keccak256("counts"), PROOF, keccak256("publication"), keccak256("privacy"), 10, 0, block.timestamp);
        results.correctResult(1, CORRECTED, keccak256("correction"));
        results.finalizeResult(1);
        results.archiveQuestion(Q1, keccak256("archive"), keccak256("manifest"));
        (bytes32 questionId,,,) = results.archives(Q1);
        require(questionId == Q1, "archive missing");
    }

    function testChallengeCourtCanonicalLifecycle() public {
        uint256 challengeId = challenges.openChallenge(Q1, "methodology", keccak256("evidence"), 1);
        uint256 assignmentId = challenges.selectJuror(Q1, address(this), keccak256("selection"));
        challenges.discloseConflict(assignmentId, keccak256("none"));
        challenges.rule(challengeId, ChallengeCourt.Ruling.Rejected, keccak256("resolution"));
        uint256 appealId = challenges.appealChallenge(challengeId, keccak256("appeal"));
        challenges.ruleAppeal(appealId, ChallengeCourt.Ruling.Rejected, keccak256("appeal-resolution"));
        uint256 resultChallengeId = challenges.openResultChallenge(Q1, "tally-proof", keccak256("result-evidence"), 2);
        challenges.ruleResultChallenge(resultChallengeId, ChallengeCourt.Ruling.Sustained, keccak256("result-resolution"));
        (, , , , , ChallengeCourt.Ruling ruling,) = challenges.resultChallenges(resultChallengeId);
        require(ruling == ChallengeCourt.Ruling.Sustained, "result challenge ruling missing");
    }

    function testAdoptionDefaultsToAdvisory() public view {
        string memory level = adoption.authorityLevel(VANCOUVER);
        require(keccak256(bytes(level)) == keccak256(bytes("Advisory")), "not advisory");
    }

    function testAdoptionPolicyGovernanceAndEmergency() public {
        uint256 policyId = adoption.proposePolicy(
            VANCOUVER,
            "Recognized",
            keccak256("quorum"),
            keccak256("approval"),
            keccak256("legal"),
            keccak256("fork"),
            keccak256("proposal")
        );
        adoption.activatePolicy(policyId, keccak256("activation"));
        string memory level = adoption.authorityLevel(VANCOUVER);
        require(keccak256(bytes(level)) == keccak256(bytes("Recognized")), "policy inactive");
        uint256 parameterSetId = adoption.proposeGovernanceParameters(VANCOUVER, keccak256("parameters"));
        adoption.activateGovernanceParameters(parameterSetId, keccak256("parameters-activation"));
        adoption.suspendCommunity(VANCOUVER, keccak256("emergency"));
        require(adoption.emergencySuspended(VANCOUVER), "emergency missing");
        adoption.resolveCommunitySuspension(VANCOUVER, keccak256("resolved"));
        require(!adoption.emergencySuspended(VANCOUVER), "emergency unresolved");
    }
}
