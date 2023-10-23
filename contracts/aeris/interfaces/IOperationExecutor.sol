// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IOperationExecutor {
    struct Operation {
        address to;
        bytes data;
    }

    function executeOperations(Operation[] calldata operations) external;
}
