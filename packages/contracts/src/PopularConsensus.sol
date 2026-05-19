// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { PCToken } from "./PCToken.sol";
import { ProtocolAccess } from "./ProtocolAccess.sol";
import { StakeManager } from "./StakeManager.sol";
import { QuestionRegistry } from "./QuestionRegistry.sol";
import { ChallengeCourt } from "./ChallengeCourt.sol";
import { CredentialRegistry } from "./CredentialRegistry.sol";
import { PollManager, PollAdapter } from "./PollManager.sol";
import { TallyManager } from "./TallyManager.sol";
import { ResultArchive } from "./ResultArchive.sol";
import { AdoptionRegistry } from "./AdoptionRegistry.sol";

contract PopularConsensusModuleCatalog {
    function moduleNames() external pure returns (string[11] memory names) {
        names[0] = type(PCToken).name;
        names[1] = type(ProtocolAccess).name;
        names[2] = type(StakeManager).name;
        names[3] = type(QuestionRegistry).name;
        names[4] = type(ChallengeCourt).name;
        names[5] = type(CredentialRegistry).name;
        names[6] = type(PollManager).name;
        names[7] = type(PollAdapter).name;
        names[8] = type(TallyManager).name;
        names[9] = type(ResultArchive).name;
        names[10] = type(AdoptionRegistry).name;
    }
}
