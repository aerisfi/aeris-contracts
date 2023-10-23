// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IOperationExecutor.sol";

contract AerisWallet is IOperationExecutor {
    mapping(address => uint256) borrowedAmounts;

    function addBorrowAmount(address asset, uint256 amount) external {
        borrowedAmounts[asset] = amount + borrowedAmounts[asset];
    }
    function getBorrowedAmount(address token) public view returns(uint256) {
        return borrowedAmounts[token];
    }
    function executeOperations(
        Operation[] calldata operations
    ) external override {}
}