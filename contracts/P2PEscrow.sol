// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract P2PEscrow {
    using SafeERC20 for IERC20;

    // Events emitted during the contract functions execution
    event MarketOrderDeposit(bytes16 indexed orderId);
    event LimitOrderDeposit(bytes16 indexed orderId);

    event RefundedOrder(bytes16 indexed orderId);
    event CancelledOrder(bytes16 indexed orderId);

    // End of Events

    // errors
    error MarketOrderFailure(MarketOrderFailureReason reason);
    error RefundFailure(RefundFailureReason reason);
    error CacncelOrderFailure(CancelOrderFailureReason reason);

    enum OrderType {
        MARKET_ORDER,
        LIMIT_ORDER
    }

    enum OrderStatus {
        AWAITING_DELIVERY,
        SUCCESS,
        REFUNDED,
        CANCELLED
    }
    enum MarketOrderFailureReason {
        INVALID_STATE,
        INSUFFICIENT_BALANCE
    }
    enum RefundFailureReason {
        REFUND_ONLY_AFTER_TIMEOUT,
        INVALID_STATE
    }
    enum CancelOrderFailureReason {
        ONLY_ORDER_CREATOR_CANCEL,
        INVALID_STATE
    }

    struct Order {
        address sender;
        uint96 swapTokenAmount;
        uint96 tokenAmount;
        uint32 timeoutTime;
        uint16 tokenId;
        uint16 swapTokenId;
        OrderStatus status;
        OrderType orderType;
    }

    uint32 public orderTimeoutDuration;
    mapping(bytes16 => Order) orderMap;
    address[] tokens;

    constructor(address[] memory _tokens) {
        // Set default maturityTime period
        orderTimeoutDuration = 100000;
        tokens = _tokens;
    }

    function _pullTokens(address user, address asset, uint256 amount) private {
        if (asset == address(0)) return;
        IERC20(asset).safeTransferFrom(user, address(this), amount);
    }

    function _pushTokens(address user, address asset, uint256 amount) private {
        if (asset == address(0)) return;
        IERC20(asset).safeTransfer(user, amount);
    }

    function _sendTokens(
        address sender,
        address receiver,
        address asset,
        uint256 amount
    ) private {
        if (asset == address(0)) return;
        IERC20(asset).safeTransferFrom(sender, receiver, amount);
    }

    function setTransactionTimeout(uint32 timeoutDuration) external {
        orderTimeoutDuration = timeoutDuration;
    }

    function executeOrder(
        uint16 tokenId,
        uint96 tokenAmount,
        uint16 swapTokenId,
        uint96 swapTokenTokenAmount,
        uint32 timeoutTime,
        bytes16 orderId,
        OrderType orderType
    ) internal returns (bytes16) {
        require(tokenId < tokensLength(), "invalid tokenId");
        require(swapTokenId < tokensLength(), "invalid swap token id");

        if (orderMap[orderId].sender == address(0)) {
            _pullTokens(msg.sender, tokens[tokenId], tokenAmount);

            orderMap[orderId].sender = msg.sender;
            orderMap[orderId].tokenId = tokenId;
            orderMap[orderId].swapTokenId = swapTokenId;
            orderMap[orderId].tokenAmount = tokenAmount;
            orderMap[orderId].swapTokenAmount = swapTokenTokenAmount;
            orderMap[orderId].timeoutTime = timeoutTime;
            orderMap[orderId].status = OrderStatus.AWAITING_DELIVERY;
            orderMap[orderId].orderType = orderType;

            if (orderType == OrderType.MARKET_ORDER)
                emit MarketOrderDeposit(orderId);
            else emit LimitOrderDeposit(orderId);

            return orderId;
        }

        if (orderMap[orderId].status != OrderStatus.AWAITING_DELIVERY)
            revert MarketOrderFailure(MarketOrderFailureReason.INVALID_STATE);

        address swapToken = tokens[swapTokenId];
        uint256 swapTokenBalance = IERC20(swapToken).balanceOf(address(this));
        if (swapTokenBalance < swapTokenTokenAmount)
            revert MarketOrderFailure(
                MarketOrderFailureReason.INSUFFICIENT_BALANCE
            );
        _pushTokens(msg.sender, swapToken, swapTokenTokenAmount);

        if (orderMap[orderId].swapTokenAmount != tokenAmount)
            revert MarketOrderFailure(
                MarketOrderFailureReason.INSUFFICIENT_BALANCE
            );
        _sendTokens(
            msg.sender,
            orderMap[orderId].sender,
            tokens[tokenId],
            tokenAmount
        );

        orderMap[orderId].status = OrderStatus.SUCCESS;

        return orderId;
    }

    function marketOrder(
        uint16 tokenId,
        uint96 tokenAmount,
        uint16 swapTokenId,
        uint96 swapTokenTokenAmount,
        bytes16 orderId
    ) external returns (bytes16) {
        return
            executeOrder(
                tokenId,
                tokenAmount,
                swapTokenId,
                swapTokenTokenAmount,
                uint32(block.timestamp + orderTimeoutDuration),
                orderId,
                OrderType.MARKET_ORDER
            );
    }

    function limitOrder(
        uint16 tokenId,
        uint96 tokenAmount,
        uint16 swapTokenId,
        uint96 swapTokenTokenAmount,
        uint32 timeoutTime,
        bytes16 orderId
    ) external returns (bytes16) {
        return
            executeOrder(
                tokenId,
                tokenAmount,
                swapTokenId,
                swapTokenTokenAmount,
                timeoutTime,
                orderId,
                OrderType.LIMIT_ORDER
            );
    }

    function cancelOrder(bytes16 orderId) external {
        Order memory order = orderMap[orderId];
        if (msg.sender != order.sender)
            revert CacncelOrderFailure(
                CancelOrderFailureReason.ONLY_ORDER_CREATOR_CANCEL
            );
        if (order.status != OrderStatus.AWAITING_DELIVERY)
            revert CacncelOrderFailure(CancelOrderFailureReason.INVALID_STATE);

        _pushTokens(order.sender, tokens[order.tokenId], order.tokenAmount);

        orderMap[orderId].status = OrderStatus.CANCELLED;

        emit CancelledOrder(orderId);
    }

    function refund(bytes16 orderId) external {
        Order memory order = orderMap[orderId];
        if (block.timestamp <= order.timeoutTime)
            revert RefundFailure(RefundFailureReason.REFUND_ONLY_AFTER_TIMEOUT);
        if (order.status != OrderStatus.AWAITING_DELIVERY)
            revert RefundFailure(RefundFailureReason.INVALID_STATE);

        _pushTokens(order.sender, tokens[order.tokenId], order.tokenAmount);

        orderMap[orderId].status = OrderStatus.REFUNDED;

        emit RefundedOrder(orderId);
    }

    function getOrder(bytes16 orderId) external view returns (Order memory) {
        require(orderMap[orderId].sender != address(0), "invalid order id");
        return orderMap[orderId];
    }

    function getTokenIndex(address token) public view returns (int) {
        for (uint i = 0; i < tokens.length; i++) {
            if (tokens[i] == token) return int(i);
        }
        return -1;
    }

    function addToken(address token) external returns (uint256) {
        tokens.push(token);
        return tokens.length - 1;
    }

    function addTokens(address[] calldata _tokens) external {
        for (uint i = 0; i < _tokens.length; i++) {
            tokens.push(_tokens[i]);
        }
    }

    function tokensLength() public view returns (uint) {
        return tokens.length;
    }
}
