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

interface Vm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

contract NonStewardCaller {
    function acceptQuestion(QuestionRegistry questions, bytes32 questionId) external {
        questions.accept(questionId);
    }

    function registerIssuer(CredentialRegistry credentials, bytes32 issuerId, bytes32 schemaId) external {
        credentials.registerIssuer(issuerId, schemaId);
    }

    function openPoll(PollManager polls, uint256 pollId) external {
        polls.openPoll(pollId);
    }

    function activateCommittee(TallyManager tallies, uint256 committeeId, bytes32 activationHash) external {
        tallies.activateCommittee(committeeId, activationHash);
    }

    function ruleResultChallenge(ChallengeCourt challenges, uint256 resultChallengeId, ChallengeCourt.Ruling ruling, bytes32 resolutionHash) external {
        challenges.ruleResultChallenge(resultChallengeId, ruling, resolutionHash);
    }

    function correctResult(ResultArchive results, uint256 pollId, bytes32 correctedArtifactHash, bytes32 correctionHash) external {
        results.correctResult(pollId, correctedArtifactHash, correctionHash);
    }

    function activatePolicy(AdoptionRegistry adoption, uint256 policyId, bytes32 activationHash) external {
        adoption.activatePolicy(policyId, activationHash);
    }
}

contract PopularConsensusTest {
    Vm constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

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
    bytes32 constant TRUST_POLICY = keccak256("trust-policy");
    bytes32 constant SETUP = keccak256("setup");
    bytes32 constant ACTIVATION = keccak256("activation");
    bytes32 constant NULLIFIER = keccak256("nullifier");
    bytes32 constant BALLOT = keccak256("ballot");
    bytes32 constant PAYLOAD = keccak256("payload");
    bytes32 constant RESULT_EVIDENCE = keccak256("result-evidence");
    bytes32 constant RESOLUTION = keccak256("resolution");
    bytes32 constant ARCHIVE = keccak256("archive");
    bytes32 constant MANIFEST = keccak256("manifest");

    bytes32 constant CREDENTIAL_SCHEMA_REGISTERED = keccak256("CredentialSchemaRegistered(bytes32)");
    bytes32 constant CREDENTIAL_ISSUER_REGISTERED = keccak256("CredentialIssuerRegistered(bytes32,bytes32)");
    bytes32 constant COMMUNITY_CREDENTIAL_TRUST_POLICY_SET =
        keccak256("CommunityCredentialTrustPolicySet(bytes32,bytes32)");
    bytes32 constant TALLY_COMMITTEE_PROPOSED =
        keccak256("TallyCommitteeProposed(uint256,bytes32,bytes32,uint256,uint256,uint256)");
    bytes32 constant TALLY_COMMITTEE_ACTIVATED = keccak256("TallyCommitteeActivated(uint256,bytes32)");
    bytes32 constant TALLY_KEY_SETUP_PUBLISHED =
        keccak256("TallyKeySetupPublished(uint256,uint256,bytes32,bytes32)");
    bytes32 constant QUESTION_SUBMITTED = keccak256("QuestionSubmitted(bytes32,bytes32,address,uint256)");
    bytes32 constant QUESTION_ACCEPTED = keccak256("QuestionAccepted(bytes32,address)");
    bytes32 constant QUESTION_STATUS_CHANGED = keccak256("QuestionStatusChanged(bytes32,uint8)");
    bytes32 constant POLL_CONFIGURED = keccak256("PollConfigured(uint256,bytes32,bytes32,bytes32)");
    bytes32 constant POLL_OPENED = keccak256("PollOpened(uint256,bytes32)");
    bytes32 constant BALLOT_ACCEPTED = keccak256("BallotAccepted(uint256,bytes32,bytes32,bytes32,bytes32)");
    bytes32 constant POLL_CLOSED = keccak256("PollClosed(uint256)");
    bytes32 constant POLL_STATUS_CHANGED = keccak256("PollStatusChanged(uint256,uint8)");
    bytes32 constant TALLY_DECRYPTION_SHARE_SUBMITTED =
        keccak256("TallyDecryptionShareSubmitted(uint256,uint256,uint256,bytes32,bytes32,bytes32)");
    bytes32 constant TALLY_RESULT_PUBLISHED = keccak256("ResultPublished(uint256,uint256,bytes32,uint256)");
    bytes32 constant RESULT_PUBLISHED =
        keccak256("ResultPublished(uint256,bytes32,bytes32,bytes32,bytes32,uint256,uint256)");
    bytes32 constant RESULT_CHALLENGED = keccak256("ResultChallenged(uint256,bytes32,string)");
    bytes32 constant RESULT_CHALLENGE_RULED = keccak256("ResultChallengeRuled(uint256,uint8,bytes32)");
    bytes32 constant RESULT_FINALIZED = keccak256("ResultFinalized(uint256)");
    bytes32 constant QUESTION_ARCHIVED = keccak256("QuestionArchived(bytes32,bytes32,bytes32,address)");

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

    function testStewardGuardsRejectUnauthorizedCoordinatorActions() public {
        NonStewardCaller caller = new NonStewardCaller();

        questions.submitQuestion(Q1, V1, 0, "Verified resident response, self-selected sample");
        try caller.acceptQuestion(questions, Q1) {
            revert("unauthorized question accept");
        } catch {}

        credentials.registerSchema(RESIDENT);
        try caller.registerIssuer(credentials, ISSUER, RESIDENT) {
            revert("unauthorized issuer registration");
        } catch {}

        uint256 pollId = polls.createPoll(Q1, RESIDENT, TALLY_KEY);
        try caller.openPoll(polls, pollId) {
            revert("unauthorized poll open");
        } catch {}

        uint256 committeeId = tallies.proposeCommittee(VANCOUVER, keccak256("metadata"), 2, 3, 0);
        try caller.activateCommittee(tallies, committeeId, ACTIVATION) {
            revert("unauthorized committee activation");
        } catch {}

        uint256 resultChallengeId = challenges.openResultChallenge(Q1, "tally-proof", RESULT_EVIDENCE, 2);
        try caller.ruleResultChallenge(challenges, resultChallengeId, ChallengeCourt.Ruling.Rejected, RESOLUTION) {
            revert("unauthorized result challenge ruling");
        } catch {}

        results.publishResultWithProof(1, ARTIFACT, keccak256("counts"), PROOF, PROOF, keccak256("privacy"), 1, 0, block.timestamp);
        try caller.correctResult(results, 1, CORRECTED, keccak256("correction")) {
            revert("unauthorized result correction");
        } catch {}

        uint256 policyId = adoption.proposePolicy(
            VANCOUVER,
            "Binding",
            keccak256("quorum"),
            keccak256("approval"),
            keccak256("handoff"),
            keccak256("fork"),
            keccak256("proposal")
        );
        try caller.activatePolicy(adoption, policyId, ACTIVATION) {
            revert("unauthorized policy activation");
        } catch {}
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

    function testFullProtocolLifecycleEmitsReplayableEvents() public {
        VM.recordLogs();

        credentials.registerSchema(RESIDENT);
        credentials.registerIssuer(ISSUER, RESIDENT);
        credentials.setTrustPolicy(VANCOUVER, TRUST_POLICY);
        uint256 committeeId = tallies.proposeCommittee(VANCOUVER, keccak256("metadata"), 2, 3, 0);
        tallies.activateCommittee(committeeId, ACTIVATION);
        uint256 setupId = tallies.publishTallyKey(committeeId, TALLY_KEY, SETUP);
        questions.submitQuestion(Q1, V1, 1, "Verified resident response, self-selected sample");
        questions.accept(Q1);
        uint256 pollId = polls.createPoll(Q1, RESIDENT, TALLY_KEY);
        polls.openPoll(pollId);
        polls.submitBallot(pollId, NULLIFIER, BALLOT, PAYLOAD, PROOF);
        polls.closePoll(pollId);
        tallies.submitDecryptionShare(pollId, setupId, MEMBER_1, SHARE_1, keccak256("proof-1"));
        tallies.submitDecryptionShare(pollId, setupId, MEMBER_2, SHARE_2, keccak256("proof-2"));
        tallies.publishTallyProof(pollId, setupId, PROOF);
        results.publishResultWithProof(pollId, ARTIFACT, keccak256("counts"), PROOF, PROOF, keccak256("privacy"), 1, 0, block.timestamp);
        uint256 resultChallengeId = challenges.openResultChallenge(Q1, "tally-proof", RESULT_EVIDENCE, 2);
        challenges.ruleResultChallenge(resultChallengeId, ChallengeCourt.Ruling.Rejected, RESOLUTION);
        results.finalizeResult(pollId);
        results.archiveQuestion(Q1, ARCHIVE, MANIFEST);

        Vm.Log[] memory logs = VM.getRecordedLogs();
        require(logs.length == 23, "unexpected replay event count");

        assertReplayEvent(logs, address(credentials), CREDENTIAL_SCHEMA_REGISTERED, RESIDENT, 2, 0, "schema event");
        assertReplayEvent(logs, address(credentials), CREDENTIAL_ISSUER_REGISTERED, ISSUER, 3, 0, "issuer event");
        assertReplayEvent(logs, address(credentials), COMMUNITY_CREDENTIAL_TRUST_POLICY_SET, VANCOUVER, 2, 32, "trust policy event");
        assertReplayEvent(logs, address(tallies), TALLY_COMMITTEE_PROPOSED, topic(committeeId), 3, 128, "committee proposed event");
        assertReplayEvent(logs, address(tallies), TALLY_COMMITTEE_ACTIVATED, topic(committeeId), 2, 32, "committee activated event");
        assertReplayEvent(logs, address(tallies), TALLY_KEY_SETUP_PUBLISHED, topic(setupId), 3, 64, "tally key event");
        assertReplayEvent(logs, address(questions), QUESTION_SUBMITTED, Q1, 3, 64, "question submitted event");
        assertReplayEvent(logs, address(questions), QUESTION_ACCEPTED, Q1, 3, 0, "question accepted event");
        assertReplayEvent(logs, address(questions), QUESTION_STATUS_CHANGED, Q1, 2, 32, "question status event");
        assertReplayEvent(logs, address(polls), POLL_CONFIGURED, topic(pollId), 3, 64, "poll configured event");
        assertReplayEvent(logs, address(polls), POLL_OPENED, topic(pollId), 3, 0, "poll opened event");
        assertReplayEvent(logs, address(polls), BALLOT_ACCEPTED, topic(pollId), 3, 96, "ballot accepted event");
        assertReplayEvent(logs, address(polls), POLL_CLOSED, topic(pollId), 2, 0, "poll closed event");
        assertReplayEvent(logs, address(polls), POLL_STATUS_CHANGED, topic(pollId), 2, 32, "poll status event");
        assertReplayEvent(
            logs,
            address(tallies),
            TALLY_DECRYPTION_SHARE_SUBMITTED,
            topic(1),
            4,
            96,
            "first share event"
        );
        assertReplayEvent(
            logs,
            address(tallies),
            TALLY_DECRYPTION_SHARE_SUBMITTED,
            topic(2),
            4,
            96,
            "second share event"
        );
        assertReplayEvent(logs, address(tallies), TALLY_RESULT_PUBLISHED, topic(pollId), 3, 64, "tally result event");
        assertReplayEvent(logs, address(results), RESULT_PUBLISHED, topic(pollId), 2, 192, "result artifact event");
        assertReplayEvent(logs, address(challenges), RESULT_CHALLENGED, topic(resultChallengeId), 3, 96, "result challenged event");
        assertReplayEvent(
            logs,
            address(challenges),
            RESULT_CHALLENGE_RULED,
            topic(resultChallengeId),
            2,
            64,
            "result challenge ruled event"
        );
        assertReplayEvent(logs, address(results), RESULT_FINALIZED, topic(pollId), 2, 0, "result finalized event");
        assertReplayEvent(logs, address(results), QUESTION_ARCHIVED, Q1, 2, 96, "question archived event");
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

    function assertReplayEvent(
        Vm.Log[] memory logs,
        address emitter,
        bytes32 eventSignature,
        bytes32 subjectTopic,
        uint256 expectedTopicCount,
        uint256 minimumDataLength,
        string memory label
    ) internal pure {
        for (uint256 i = 0; i < logs.length; i++) {
            if (
                logs[i].emitter == emitter && logs[i].topics.length == expectedTopicCount
                    && logs[i].topics[0] == eventSignature && logs[i].topics[1] == subjectTopic
                    && logs[i].data.length >= minimumDataLength
            ) {
                return;
            }
        }
        revert(label);
    }

    function topic(uint256 value) internal pure returns (bytes32) {
        return bytes32(value);
    }
}
