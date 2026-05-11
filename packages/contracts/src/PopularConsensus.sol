// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PCToken {
    string private constant NAME = "Popular Consensus";
    string private constant SYMBOL = "PC";
    uint8 private constant DECIMALS = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(uint256 initialSupply) {
        _mint(msg.sender, initialSupply);
    }

    function name() external pure returns (string memory) {
        return NAME;
    }

    function symbol() external pure returns (string memory) {
        return SYMBOL;
    }

    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "PC: allowance");
        allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "PC: balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}

contract StakeManager {
    enum BondType {
        Proposal,
        Challenge,
        Appeal
    }

    enum BondStatus {
        Escrowed,
        Settled
    }

    struct Bond {
        address owner;
        bytes32 questionId;
        bytes32 challengeId;
        uint256 amountPc;
        BondType bondType;
        BondStatus status;
        uint256 slashedPc;
        uint256 refundedPc;
        uint256 rewardPc;
        uint256 treasuryPc;
    }

    PCToken public immutable PC_TOKEN;
    address public treasury;
    uint256 public proposalBondMinPc = 100 ether;
    uint256 public challengeBondMinPc = 50 ether;
    uint256 public appealBondMultiplier = 2;
    uint256 public minorBreachSlashRateBps = 2_500;
    uint256 public majorBreachSlashRateBps = 10_000;
    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;

    event BondEscrowed(
        uint256 indexed bondId,
        bytes32 indexed questionId,
        bytes32 indexed challengeId,
        address owner,
        BondType bondType,
        uint256 amountPc
    );
    event BondSettled(uint256 indexed bondId, uint256 slashedPc, uint256 refundedPc, uint256 rewardPc, uint256 treasuryPc);
    event BondRefunded(uint256 indexed bondId);
    event BondSlashed(uint256 indexed bondId, uint256 amountPc);

    constructor(PCToken token, address treasury_) {
        PC_TOKEN = token;
        treasury = treasury_;
    }

    function moduleId() external pure returns (string memory) {
        return "StakeManager";
    }

    function escrowProposal(bytes32 questionId, uint256 amountPc) external returns (uint256) {
        require(amountPc >= proposalBondMinPc, "Stake: proposal min");
        return _escrow(msg.sender, questionId, bytes32(0), amountPc, BondType.Proposal);
    }

    function escrowChallenge(bytes32 questionId, bytes32 challengeId, uint256 amountPc) external returns (uint256) {
        require(amountPc >= challengeBondMinPc, "Stake: challenge min");
        return _escrow(msg.sender, questionId, challengeId, amountPc, BondType.Challenge);
    }

    function refund(uint256 bondId) external {
        Bond storage bond = bonds[bondId];
        require(msg.sender == bond.owner, "Stake: owner");
        require(bond.status == BondStatus.Escrowed, "Stake: status");
        _markSettled(bond, 0, bond.amountPc, 0, 0);
        require(PC_TOKEN.transfer(bond.owner, bond.amountPc), "Stake: refund");
        emit BondSettled(bondId, 0, bond.amountPc, 0, 0);
        emit BondRefunded(bondId);
    }

    function slash(uint256 bondId, uint256 slashRateBps) external {
        Bond storage bond = bonds[bondId];
        require(bond.status == BondStatus.Escrowed, "Stake: status");
        require(slashRateBps <= 10_000, "Stake: bps");
        uint256 slashed = (bond.amountPc * slashRateBps) / 10_000;
        uint256 refunded = bond.amountPc - slashed;
        _markSettled(bond, slashed, refunded, 0, slashed);
        if (slashed > 0) {
            require(PC_TOKEN.transfer(treasury, slashed), "Stake: slash");
        }
        if (refunded > 0) {
            require(PC_TOKEN.transfer(bond.owner, refunded), "Stake: partial refund");
        }
        emit BondSettled(bondId, slashed, refunded, 0, slashed);
        emit BondSlashed(bondId, slashed);
    }

    function _escrow(
        address owner,
        bytes32 questionId,
        bytes32 challengeId,
        uint256 amountPc,
        BondType bondType
    ) internal returns (uint256 bondId) {
        require(PC_TOKEN.transferFrom(owner, address(this), amountPc), "Stake: transfer");
        bondId = nextBondId++;
        bonds[bondId] = Bond({
            owner: owner,
            questionId: questionId,
            challengeId: challengeId,
            amountPc: amountPc,
            bondType: bondType,
            status: BondStatus.Escrowed,
            slashedPc: 0,
            refundedPc: 0,
            rewardPc: 0,
            treasuryPc: 0
        });
        emit BondEscrowed(bondId, questionId, challengeId, owner, bondType, amountPc);
    }

    function _markSettled(
        Bond storage bond,
        uint256 slashedPc,
        uint256 refundedPc,
        uint256 rewardPc,
        uint256 treasuryPc
    ) internal {
        require(slashedPc + refundedPc == bond.amountPc, "Stake: settlement total");
        bond.status = BondStatus.Settled;
        bond.slashedPc = slashedPc;
        bond.refundedPc = refundedPc;
        bond.rewardPc = rewardPc;
        bond.treasuryPc = treasuryPc;
    }
}

contract QuestionRegistry {
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

    function setStatus(bytes32 questionId, Status status) external {
        require(questions[questionId].version > 0, "Question: missing");
        questions[questionId].status = status;
        emit QuestionStatusChanged(questionId, status);
    }

    function accept(bytes32 questionId) external {
        require(questions[questionId].version > 0, "Question: missing");
        questions[questionId].status = Status.Accepted;
        emit QuestionAccepted(questionId, msg.sender);
        emit QuestionStatusChanged(questionId, Status.Accepted);
    }

    function reject(bytes32 questionId, bytes32 reasonHash) external {
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

    function archive(bytes32 questionId, bytes32 archiveHash) external {
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

contract ChallengeCourt {
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

    function selectJuror(bytes32 targetId, address juror, bytes32 selectionHash) external returns (uint256 assignmentId) {
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

    function rule(uint256 challengeId, Ruling ruling, bytes32 resolutionHash) external {
        require(challenges[challengeId].challenger != address(0), "Challenge: missing");
        challenges[challengeId].ruling = ruling;
        challenges[challengeId].resolutionHash = resolutionHash;
        emit ChallengeRuled(challengeId, ruling, resolutionHash);
    }

    function ruleResultChallenge(uint256 resultChallengeId, Ruling ruling, bytes32 resolutionHash) external {
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

    function ruleAppeal(uint256 appealId, Ruling ruling, bytes32 resolutionHash) external {
        require(appeals[appealId].appellant != address(0), "Challenge: appeal missing");
        appeals[appealId].ruling = ruling;
        appeals[appealId].resolutionHash = resolutionHash;
        emit ChallengeAppealRuled(appealId, ruling, resolutionHash);
    }
}

contract CredentialRegistry {
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

    function registerSchema(bytes32 schemaId) external {
        activeSchemas[schemaId] = true;
        emit CredentialSchemaRegistered(schemaId);
    }

    function registerIssuer(bytes32 issuerId, bytes32 schemaId) external {
        require(activeSchemas[schemaId], "Credential: schema");
        activeIssuers[issuerId] = true;
        emit CredentialIssuerRegistered(issuerId, schemaId);
    }

    function suspendIssuer(bytes32 issuerId, bytes32 suspensionHash) external {
        require(activeIssuers[issuerId], "Credential: issuer");
        activeIssuers[issuerId] = false;
        emit CredentialIssuerSuspended(issuerId, suspensionHash);
    }

    function updateRevocationRoot(bytes32 schemaId, bytes32 revocationRoot) external {
        require(activeSchemas[schemaId], "Credential: schema");
        revocationRootBySchema[schemaId] = revocationRoot;
        emit CredentialRevocationRootUpdated(schemaId, revocationRoot);
    }

    function setTrustPolicy(bytes32 communityId, bytes32 trustPolicyHash) external {
        trustPolicyByCommunity[communityId] = trustPolicyHash;
        emit CommunityCredentialTrustPolicySet(communityId, trustPolicyHash);
    }
}

contract PollManager {
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

    function createPoll(bytes32 questionId, bytes32 credentialSchemaId, bytes32 tallyPublicKeyId) external returns (uint256 pollId) {
        return configurePoll(questionId, credentialSchemaId, tallyPublicKeyId, 0, 0);
    }

    function configurePoll(
        bytes32 questionId,
        bytes32 credentialSchemaId,
        bytes32 tallyPublicKeyId,
        uint256 opensAt,
        uint256 closesAt
    ) public returns (uint256 pollId) {
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

    function setStatus(uint256 pollId, PollStatus status) external {
        require(polls[pollId].questionId != bytes32(0), "Poll: missing");
        polls[pollId].status = status;
        emit PollStatusChanged(pollId, status);
    }

    function openPoll(uint256 pollId) external {
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

    function closePoll(uint256 pollId) external {
        Poll storage poll = polls[pollId];
        require(poll.status == PollStatus.Open, "Poll: not open");
        poll.status = PollStatus.Closed;
        emit PollClosed(pollId);
        emit PollStatusChanged(pollId, PollStatus.Closed);
    }

    function markResultPublished(uint256 pollId) external {
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

contract TallyManager {
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
    ) external returns (uint256 committeeId) {
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

    function activateCommittee(uint256 committeeId, bytes32 activationHash) external {
        Committee storage committee = committees[committeeId];
        require(committee.communityId != bytes32(0), "Tally: committee");
        require(committee.status == CommitteeStatus.Proposed, "Tally: status");
        committee.status = CommitteeStatus.Active;
        committee.activationHash = activationHash;
        emit TallyCommitteeActivated(committeeId, activationHash);
    }

    function failCommittee(uint256 committeeId, bytes32 failureHash, uint256 replacementCommitteeId) external {
        Committee storage committee = committees[committeeId];
        require(committee.communityId != bytes32(0), "Tally: committee");
        require(committee.status == CommitteeStatus.Active, "Tally: status");
        committee.status = CommitteeStatus.Failed;
        committee.failureHash = failureHash;
        emit TallyCommitteeFailed(committeeId, failureHash, replacementCommitteeId);
    }

    function publishTallyKey(uint256 committeeId, bytes32 publicKeyId, bytes32 setupHash) external returns (uint256 setupId) {
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

    function publishTallyProof(uint256 pollId, uint256 setupId, bytes32 tallyPublicationProofHash) external {
        KeySetup storage setup = keySetups[setupId];
        require(setup.active, "Tally: setup");
        uint256 acceptedShareCount = acceptedShareCountByPollAndSetup[pollId][setupId];
        require(acceptedShareCount >= setup.threshold, "Tally: threshold");
        emit ResultPublished(pollId, setupId, tallyPublicationProofHash, acceptedShareCount);
    }
}

contract ResultArchive {
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

    function publishResult(uint256 pollId, bytes32 artifactHash, bytes32 tallyProofHash, uint256 turnout, uint256 challengeWindowEndsAt) external {
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
    ) public {
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

    function correctResult(uint256 pollId, bytes32 correctedArtifactHash, bytes32 correctionHash) external {
        Result storage result = results[pollId];
        require(result.artifactHash != bytes32(0), "Result: missing");
        require(correctedArtifactHash != bytes32(0), "Result: corrected artifact");
        result.artifactHash = correctedArtifactHash;
        result.status = FinalStatus.Corrected;
        emit ResultCorrected(pollId, correctedArtifactHash, correctionHash);
    }

    function finalizeResult(uint256 pollId) external {
        Result storage result = results[pollId];
        require(result.artifactHash != bytes32(0), "Result: missing");
        require(block.timestamp >= result.challengeWindowEndsAt, "Result: challenge window");
        result.status = FinalStatus.Finalized;
        emit ResultFinalized(pollId);
    }

    function archiveQuestion(bytes32 questionId, bytes32 archiveHash, bytes32 artifactManifestHash) external {
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

contract AdoptionRegistry {
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

    function activatePolicy(uint256 policyId, bytes32 activationHash) public {
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

    function suspendPolicy(uint256 policyId, bytes32 suspensionReasonHash) external {
        AdoptionPolicy storage policy = policies[policyId];
        require(policy.status == PolicyStatus.Active, "Adoption: active");
        policy.status = PolicyStatus.Suspended;
        policy.suspensionReasonHash = suspensionReasonHash;
        if (activePolicyByCommunity[policy.communityId] == policyId) {
            activePolicyByCommunity[policy.communityId] = 0;
        }
        emit AdoptionPolicySuspended(policyId, policy.communityId, suspensionReasonHash);
    }

    function setPolicy(bytes32 communityId, string calldata newAuthorityLevel) external {
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

    function activateGovernanceParameters(uint256 parameterSetId, bytes32 activationHash) external {
        GovernanceParameters storage parameters = governanceParameters[parameterSetId];
        require(parameters.communityId != bytes32(0), "Adoption: parameters");
        parameters.active = true;
        activeParameterSetByCommunity[parameters.communityId] = parameterSetId;
        emit GovernanceParametersActivated(parameterSetId, parameters.communityId, activationHash);
    }

    function suspendCommunity(bytes32 communityId, bytes32 emergencyReasonHash) external {
        require(communityId != bytes32(0), "Adoption: community");
        emergencySuspended[communityId] = true;
        emergencyReasonHashByCommunity[communityId] = emergencyReasonHash;
        emit CommunityEmergencySuspended(communityId, emergencyReasonHash);
    }

    function resolveCommunitySuspension(bytes32 communityId, bytes32 emergencyResolutionHash) external {
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
