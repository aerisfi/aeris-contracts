// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library PullerPusher {
    using SafeERC20 for IERC20;

    /**
     * Helper function for transferring asset from user in to the smart contract
     * @param user address from which the tokens are pulled in to this contract
     * @param asset token address which is being pulled from the user
     * @param amount amount of token address that is being pulled from user
     */
    function pullTokens(address user, address asset, uint256 amount) public {
        if (asset == address(0)) return;
        IERC20(asset).safeTransferFrom(user, address(this), amount);
    }

    /**
     * Helper function for transferring asset from this smart contract to user
     * @param user asset receiving address
     * @param asset token address which is sent to user
     * @param amount amount of token address that is being sent to user
     */
    function pushTokens(address user, address asset, uint256 amount) public {
        if (asset == address(0)) return;
        IERC20(asset).safeTransfer(user, amount);
    }
}