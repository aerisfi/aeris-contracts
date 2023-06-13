// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract P2PEscrow {
    using SafeERC20 for IERC20;

    // Events emitted during the contract functions execution
    event EscrowDeposit(bytes16 indexed transactionId);

    event RefundedTransaction(bytes16 indexed transactionId);
    // End of Events

    // errors
    error DepositFailure(DepositFailureReason reason);
    error RefundFailure(RefundFailureReason reason);
    enum TransactionStatus {
        AWAITING_DELIVERY,
        SUCCESS,
        REFUNDED
    }
    enum DepositFailureReason {
        INVALID_STATE,
        INSUFFICIENT_BALANCE
    }
    enum RefundFailureReason {
        REFUND_ONLY_AFTER_TIMEOUT,
        INVALID_STATE,
        INSUFFICIENT_BALANCE
    }

    struct Transaction {
        address sender;
        address token;
        address receiver;
        address receiverToken;
        uint256 tokenAmount;
        uint256 receiverTokenAmount;
        uint256 timeoutTime;
        TransactionStatus status;
    }

    uint public transactionTimeoutDuration;
    mapping(address => mapping(address => uint256)) userTokensMapping;
    mapping(bytes16 => Transaction) transactionMap;

    constructor() {
        // Set default maturityTime period
        transactionTimeoutDuration = 100000;
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

    function setTransactionTimeout(uint timeoutDuration) external {
        transactionTimeoutDuration = timeoutDuration;
    }

    function deposit(
        address token,
        uint256 tokenAmount,
        address receiverToken,
        uint256 receiverTokenAmount,
        address receiver,
        bytes16 transactionId
    ) external returns (bytes16) {
        uint256 tokenBalance = userTokensMapping[msg.sender][token];

        Transaction memory transaction = transactionMap[transactionId];
        if (transaction.sender == address(0)) {

            _pullTokens(msg.sender, token, tokenAmount);
            unchecked {
                tokenBalance = tokenBalance + tokenAmount;
            }

            transactionMap[transactionId].sender = msg.sender;
            transactionMap[transactionId].token = token;
            transactionMap[transactionId].receiverToken = receiverToken;
            transactionMap[transactionId].tokenAmount = tokenAmount;
            transactionMap[transactionId].receiver = receiver;
            transactionMap[transactionId].receiverTokenAmount = receiverTokenAmount;
            transactionMap[transactionId].timeoutTime = block.timestamp + transactionTimeoutDuration;
            transactionMap[transactionId].status = TransactionStatus.AWAITING_DELIVERY;

            emit EscrowDeposit(transactionId);
            userTokensMapping[msg.sender][token] = tokenBalance;
            return transactionId;
        }

        uint256 receiverTokenBalance = userTokensMapping[receiver][
            receiverToken
        ];
        if (transaction.status != TransactionStatus.AWAITING_DELIVERY)
            revert DepositFailure(DepositFailureReason.INVALID_STATE);

        if (receiverTokenBalance < receiverTokenAmount)
            revert DepositFailure(DepositFailureReason.INSUFFICIENT_BALANCE);
        _pushTokens(msg.sender, receiverToken, receiverTokenAmount);
        unchecked {
            receiverTokenBalance = receiverTokenBalance - receiverTokenAmount;
        }

        if (transaction.receiverTokenAmount != tokenAmount)
            revert DepositFailure(DepositFailureReason.INSUFFICIENT_BALANCE);
        _sendTokens(msg.sender, receiver, token, tokenAmount);

        userTokensMapping[receiver][receiverToken] = receiverTokenBalance;
        transactionMap[transactionId].status = TransactionStatus.SUCCESS;

        return transactionId;
    }

    function refund(bytes16 transactionId)  external {
        Transaction memory transaction = transactionMap[transactionId];
        if (block.timestamp <= transaction.timeoutTime)
            revert RefundFailure(RefundFailureReason.REFUND_ONLY_AFTER_TIMEOUT);
        if (transaction.status != TransactionStatus.AWAITING_DELIVERY)
            revert RefundFailure(RefundFailureReason.INVALID_STATE);

        uint256 tokenBalance = userTokensMapping[transaction.sender][
            transaction.token
        ];
        if (tokenBalance < transaction.tokenAmount)
            revert RefundFailure(RefundFailureReason.INSUFFICIENT_BALANCE);

        _pushTokens(
            transaction.sender,
            transaction.token,
            transaction.tokenAmount
        );
        tokenBalance -= transaction.tokenAmount;
        userTokensMapping[transaction.sender][transaction.token] = tokenBalance;
        transaction.status = TransactionStatus.REFUNDED;
        transactionMap[transactionId] = transaction;

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

    function getUserBalances(
        address user,
        address token
    ) external view returns (uint256) {
        return userTokensMapping[user][token];
    }
}


