// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import "./interfaces/IBanker.sol";
import "./tokens/Aeris.sol";
import {PullerPusher} from "./lib/PullerPusher.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract LenderManager {
    IBanker banker;
    ISwapRouter public immutable swapRouter;
    IUniswapV2Router02 public immutable routerV2;
    // user => (token => lend amount)
    mapping(address => mapping(address => uint256)) lendAmountMapping;

    mapping(address => address) swapTokenMapping;
    address SDAI = 0x83F20F44975D03b1b09e64809B757c47f942BEeA;

    constructor(
        address _banker,
        ISwapRouter _swapRouter,
        IUniswapV2Router02 _routerV2,
        address[] memory sourceTokens,
        address[] memory swapTokens
    ) {
        banker = IBanker(_banker);
        swapRouter = ISwapRouter(_swapRouter);
        routerV2 = IUniswapV2Router02(_routerV2);
        for (uint i = 0; i < sourceTokens.length; i++) {
            swapTokenMapping[sourceTokens[i]] = swapTokens[i];
        }
    }

    function addSwapMapping(address tokenIn, address tokenOut) external {
        swapTokenMapping[tokenIn] = tokenOut;
    }

    function swapExactInputSingle(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) private returns (uint256 amountOut) {
        if (tokenOut == SDAI) {
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            uint[] memory amounts = routerV2.swapExactTokensForTokens(
                amountIn,
                0, //amountOutMinimum
                path,
                address(this), // recipient of swapped tokens
                block.timestamp
            );
            amountOut = amounts[0];
        } else {
            // Approve the router to spend tokenIn.
            TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

            // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
            // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
                .ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: 3000, // hardcoding pool fee to 0.3% for this example
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: amountIn,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                });

            // The call to `exactInputSingle` executes the swap.
            amountOut = swapRouter.exactInputSingle(params);
        }
    }

    function lend(address token, uint256 amount) external {
        // pull token from user
        PullerPusher.pullTokens(msg.sender, token, amount);

        // swap the token to the mapped swap token using uniswap
        address tokenOut = swapTokenMapping[token];
        require(tokenOut != address(0), "token cannot be lent");
        uint256 swappedTokenAmount = swapExactInputSingle(
            token,
            amount,
            tokenOut
        );

        // lend the swapped token through banker
        IERC20(tokenOut).approve(address(banker), swappedTokenAmount);
        banker.lend(tokenOut, swappedTokenAmount);
        lendAmountMapping[msg.sender][token] =
            amount +
            lendAmountMapping[msg.sender][token];
    }

    function getLentAmount(
        address lender,
        address token
    ) external view returns (uint256) {
        return lendAmountMapping[lender][token];
    }
}
