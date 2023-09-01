// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "hardhat/console.sol";

import "./interfaces/IQuote.sol";

contract Escrow is Ownable2Step, ReentrancyGuard, IQuote {
    using SafeERC20 for IERC20;

    // List of whitelisted token addresses
    address[] tokens;
    // Quote status
    mapping(bytes32 => OrderStatus) quoteStatus;

    constructor(address[] memory _tokens) {
        tokens = _tokens;
    }

    function getOrderStatus(
        OrderQuote memory quote
    ) external view returns (OrderStatus) {
        bytes32 orderHash = _hashOrderQuote(quote);
        return quoteStatus[orderHash];
    }

    function serveOrder(OrderQuote memory quote) external {
        bytes32 orderHash = _hashOrderQuote(quote);
        OrderStatus status = quoteStatus[orderHash];
        require(
            _msgSender() != quote.creator,
            "order creator cannot serve the order"
        );
        require(
            status == OrderStatus.RECEIVED,
            "order should be received before serving it"
        );
        quoteStatus[orderHash] = OrderStatus.FULFILLED;
        _sendTokens(
            quote.creator,
            _msgSender(),
            tokens[quote.inTokenId],
            quote.inTokenAmount
        );
        _sendTokens(
            _msgSender(),
            quote.creator,
            tokens[quote.outTokenId],
            quote.outTokenAmount
        );
        emit FulfilledOrder(quote.orderId);
    }

    function executeOrder(OrderQuote memory quote) internal {
        bytes32 orderHash = _hashOrderQuote(quote);
        OrderStatus status = quoteStatus[orderHash];
        require(
            status == OrderStatus.UN_INITIATED,
            "order should not be initiated before"
        );
        require(
            _msgSender() == quote.creator,
            "transaction initiator should be order creator"
        );
        quoteStatus[orderHash] = OrderStatus.RECEIVED;
        return;
    }

    function marketOrder(OrderQuote memory quote) external {
        require(quote.orderType == OrderType.MARKET_ORDER);
        executeOrder(quote);
        emit ReceivedOrder(quote.orderId);
    }

    function cancelOrder(OrderQuote memory quote) external {
        bytes32 orderHash = _hashOrderQuote(quote);
        require(
            quoteStatus[orderHash] == OrderStatus.RECEIVED,
            "incorrect order state"
        );
        require(
            (msg.sender == quote.creator || msg.sender == owner()),
            "order can be cancelled by order creator or contract owner only"
        );
        quoteStatus[orderHash] = OrderStatus.CANCELLED;
        emit CancelledOrder(quote.orderId);
    }

    /**
     * Helper function for transferring asset from sender to receiver
     * @param sender token sending address
     * @param receiver token receiving address
     * @param asset token address which is being sent from sender to receiver
     * @param amount amount of token address that is being sent from sender to receiver
     */
    function _sendTokens(
        address sender,
        address receiver,
        address asset,
        uint256 amount
    ) private {
        if (asset == address(0)) return;
        IERC20(asset).safeTransferFrom(sender, receiver, amount);
    }

    /**
     * get index of the whitelisted token address
     * @param token whitelisted token address
     */
    function getTokenIndex(address token) external view returns (int) {
        for (uint i = 0; i < tokens.length; i++) {
            if (tokens[i] == token) return int(i);
        }
        return -1;
    }

    /**
     * get whitelisted token address by index
     * @param index whitelisted token index
     */
    function getTokenAddressByIndex(
        uint index
    ) external view returns (address) {
        require(index < tokensLength(), "invalid index");
        return tokens[index];
    }

    /**
     * @notice The smart contract owner can add tokens to the contract and whitelist them
     * for using in executing the market order or limit order
     * @param inputTokens tokens that have to be whitelisted
     */
    function addTokens(address[] calldata inputTokens) external onlyOwner {
        for (uint i = 0; i < inputTokens.length; i++) {
            tokens.push(inputTokens[i]);
        }
    }

    /**
     * @notice helper function to find the total number of whitelisted
     * tokens in the smart contract
     */
    function tokensLength() public view returns (uint) {
        return tokens.length;
    }

    /**
     * @dev Generates a quote hash for OrderQuote.
     */
    function _hashOrderQuote(
        OrderQuote memory quote
    ) private view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    quote.orderId,
                    quote.creator,
                    quote.outTokenAmount,
                    quote.outTokenId,
                    quote.inTokenAmount,
                    quote.inTokenId,
                    quote.orderType,
                    block.chainid
                )
            );
    }
}
