// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IBanker {
    function lend(address token, uint256 amount) external;
    function borrow(address token, uint256 amount, address receiver) external;
    function repay(address token, uint256 amount) external;
}
