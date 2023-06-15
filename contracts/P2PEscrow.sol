// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract P2PEscrow {
    using SafeERC20 for IERC20;

    // Events emitted during the contract functions execution
    event EscrowDeposit(bytes16 indexed transactionId);

    event RefundedTransaction(bytes16 indexed transactionId);
    event CancelledOrder(bytes16 indexed transactionId);

    // End of Events

    // errors
    error DepositFailure(DepositFailureReason reason);
    error RefundFailure(RefundFailureReason reason);
    error CacncelOrderFailure(CancelOrderFailureReason reason);

    enum TransactionStatus {
        AWAITING_DELIVERY,
        SUCCESS,
        REFUNDED,
        CANCELLED
    }
    enum DepositFailureReason {
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

    struct Transaction {
        address sender;
        uint96 swapTokenAmount;
        uint96 tokenAmount;
        uint32 timeoutTime;
        uint16 tokenId;
        uint16 swapTokenId;
        TransactionStatus status;
    }

    uint32 public transactionTimeoutDuration;
    mapping(bytes16 => Transaction) transactionMap;
    address[] tokens;

    constructor(address[] memory _tokens) {
        // Set default maturityTime period
        transactionTimeoutDuration = 100000;
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
        transactionTimeoutDuration = timeoutDuration;
    }

    function deposit(
        uint16 tokenId,
        uint96 tokenAmount,
        uint16 swapTokenId,
        uint96 swapTokenTokenAmount,
        bytes16 transactionId
    ) external returns (bytes16) {
        require(tokenId < tokensLength(), "invalid tokenId");
        require(swapTokenId < tokensLength(), "invalid swap token id");

        if (transactionMap[transactionId].sender == address(0)) {
            _pullTokens(msg.sender, tokens[tokenId], tokenAmount);

            transactionMap[transactionId].sender = msg.sender;
            transactionMap[transactionId].tokenId = tokenId;
            transactionMap[transactionId].swapTokenId = swapTokenId;
            transactionMap[transactionId].tokenAmount = tokenAmount;
            transactionMap[transactionId]
                .swapTokenAmount = swapTokenTokenAmount;
            transactionMap[transactionId].timeoutTime =
                uint32(block.timestamp) +
                transactionTimeoutDuration;
            transactionMap[transactionId].status = TransactionStatus
                .AWAITING_DELIVERY;

            emit EscrowDeposit(transactionId);
            return transactionId;
        }

        if (
            transactionMap[transactionId].status !=
            TransactionStatus.AWAITING_DELIVERY
        ) revert DepositFailure(DepositFailureReason.INVALID_STATE);

        address swapToken = tokens[swapTokenId];
        uint256 swapTokenBalance = IERC20(swapToken).balanceOf(address(this));
        if (swapTokenBalance < swapTokenTokenAmount)
            revert DepositFailure(DepositFailureReason.INSUFFICIENT_BALANCE);
        _pushTokens(msg.sender, swapToken, swapTokenTokenAmount);

        if (transactionMap[transactionId].swapTokenAmount != tokenAmount)
            revert DepositFailure(DepositFailureReason.INSUFFICIENT_BALANCE);
        _sendTokens(
            msg.sender,
            transactionMap[transactionId].sender,
            tokens[tokenId],
            tokenAmount
        );

        transactionMap[transactionId].status = TransactionStatus.SUCCESS;

        return transactionId;
    }

    function cancelOrder(bytes16 transactionId) external {
        Transaction memory transaction = transactionMap[transactionId];
        if (msg.sender != transaction.sender)
            revert CacncelOrderFailure(
                CancelOrderFailureReason.ONLY_ORDER_CREATOR_CANCEL
            );
        if (transaction.status != TransactionStatus.AWAITING_DELIVERY)
            revert CacncelOrderFailure(CancelOrderFailureReason.INVALID_STATE);

        _pushTokens(
            transaction.sender,
            tokens[transaction.tokenId],
            transaction.tokenAmount
        );

        transactionMap[transactionId].status = TransactionStatus.CANCELLED;

        emit CancelledOrder(transactionId);
    }

    function refund(bytes16 transactionId) external {
        Transaction memory transaction = transactionMap[transactionId];
        if (block.timestamp <= transaction.timeoutTime)
            revert RefundFailure(RefundFailureReason.REFUND_ONLY_AFTER_TIMEOUT);
        if (transaction.status != TransactionStatus.AWAITING_DELIVERY)
            revert RefundFailure(RefundFailureReason.INVALID_STATE);

        _pushTokens(
            transaction.sender,
            tokens[transaction.tokenId],
            transaction.tokenAmount
        );

        transactionMap[transactionId].status = TransactionStatus.REFUNDED;

        emit RefundedTransaction(transactionId);
    }

    function getTransaction(
        bytes16 transactionId
    ) external view returns (Transaction memory) {
        require(
            transactionMap[transactionId].sender != address(0),
            "invalid transaction id"
        );
        return transactionMap[transactionId];
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
