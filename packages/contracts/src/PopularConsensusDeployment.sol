// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AdoptionRegistry } from "./AdoptionRegistry.sol";
import { ChallengeCourt } from "./ChallengeCourt.sol";
import { CredentialRegistry } from "./CredentialRegistry.sol";
import { PCToken } from "./PCToken.sol";
import { PollManager } from "./PollManager.sol";
import { QuestionRegistry } from "./QuestionRegistry.sol";
import { ResultArchive } from "./ResultArchive.sol";
import { StakeManager } from "./StakeManager.sol";
import { TallyManager } from "./TallyManager.sol";

contract PopularConsensusDeployment {
    PCToken public immutable PC_TOKEN;
    StakeManager public immutable STAKE_MANAGER;
    QuestionRegistry public immutable QUESTION_REGISTRY;
    ChallengeCourt public immutable CHALLENGE_COURT;
    CredentialRegistry public immutable CREDENTIAL_REGISTRY;
    PollManager public immutable POLL_MANAGER;
    TallyManager public immutable TALLY_MANAGER;
    ResultArchive public immutable RESULT_ARCHIVE;
    AdoptionRegistry public immutable ADOPTION_REGISTRY;

    constructor(uint256 initialSupply, address treasury) {
        PC_TOKEN = new PCToken(initialSupply);
        STAKE_MANAGER = new StakeManager(PC_TOKEN, treasury);
        QUESTION_REGISTRY = new QuestionRegistry();
        CHALLENGE_COURT = new ChallengeCourt();
        CREDENTIAL_REGISTRY = new CredentialRegistry();
        POLL_MANAGER = new PollManager();
        TALLY_MANAGER = new TallyManager();
        RESULT_ARCHIVE = new ResultArchive();
        ADOPTION_REGISTRY = new AdoptionRegistry();
    }
}
