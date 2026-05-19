// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

abstract contract ProtocolAccess {
    address public steward;

    event StewardTransferred(address indexed previousSteward, address indexed newSteward);

    constructor() {
        steward = msg.sender;
        emit StewardTransferred(address(0), msg.sender);
    }

    modifier onlySteward() {
        _onlySteward();
        _;
    }

    function transferSteward(address newSteward) external onlySteward {
        require(newSteward != address(0), "ProtocolAccess: steward zero");
        emit StewardTransferred(steward, newSteward);
        steward = newSteward;
    }

    function _onlySteward() internal view {
        require(msg.sender == steward, "ProtocolAccess: steward");
    }
}
