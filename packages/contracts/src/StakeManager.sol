// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { PCToken } from "./PCToken.sol";
import { ProtocolAccess } from "./ProtocolAccess.sol";

contract StakeManager is ProtocolAccess {
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

    function slash(uint256 bondId, uint256 slashRateBps) external onlySteward {
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
