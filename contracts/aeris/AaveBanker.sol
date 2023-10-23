// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IBanker.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PullerPusher} from "./lib/PullerPusher.sol";

contract AaveBanker is IBanker {
    using SafeERC20 for IERC20;

    IPool pool;
    address aavePoolAddress;
    constructor(address _aavePoolAddress) {
        pool = IPool(_aavePoolAddress);
        aavePoolAddress = _aavePoolAddress;
    }


    function lend(address token, uint256 amount) external override {
        IERC20 erc20Token = IERC20(token);

        // pull token from user
        PullerPusher.pullTokens(msg.sender, token, amount);
        // approve tokens to aave pool
        erc20Token.approve(aavePoolAddress, amount);
        // invoke lend on aave pool
        pool.supply(token, amount, address(this), 0);
    }

    function borrow(
        address token,
        uint256 amount,
        address receiver
    ) external override {
        IERC20 erc20Token = IERC20(token);

        // Calculate the holding amount of token by this contract
        uint256 balance = erc20Token.balanceOf(address(this));

        // invoke variable borrow on aave pool
        pool.borrow(token, amount, 2, 0, address(this));

        // now calculate the new holding amount of token by this contract
        uint256 balanceAfterBorrow = erc20Token.balanceOf(address(this));

        // calculate the received borrow tokens by the contract
        uint256 receivedBorrowAmount = balanceAfterBorrow - balance;
        // transfer the received tokens to receiver
        PullerPusher.pushTokens(receiver, token, receivedBorrowAmount);
    }

    function repay(address token, uint256 amount) external override {}
}