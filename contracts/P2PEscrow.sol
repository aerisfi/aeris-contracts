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
        uint tokenId;
        uint swapTokenId;
        uint tokenAmount;
        uint swapTokenAmount;
        uint timeoutTime;
        TransactionStatus status;
    }

    uint public transactionTimeoutDuration;
    mapping(address => mapping(uint256 => uint256)) userTokensMapping;
    mapping(bytes16 => Transaction) transactionMap;
    address[] tokens;

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
        uint tokenId,
        uint tokenAmount,
        uint swapTokenId,
        uint swapTokenTokenAmount,
        bytes16 transactionId
    ) external returns (bytes16) {
        require(tokenId < tokensLength(), "invalid tokenId");
        require(swapTokenId < tokensLength(), "invalid swap token id");

        uint256 tokenBalance = userTokensMapping[msg.sender][tokenId];

        Transaction memory transaction = transactionMap[transactionId];
        if (transaction.sender == address(0)) {

            _pullTokens(msg.sender, tokens[tokenId], tokenAmount);
            unchecked {
                tokenBalance = tokenBalance + tokenAmount;
            }

            transactionMap[transactionId].sender = msg.sender;
            transactionMap[transactionId].tokenId = tokenId;
            transactionMap[transactionId].swapTokenId = swapTokenId;
            transactionMap[transactionId].tokenAmount = tokenAmount;
            transactionMap[transactionId].swapTokenAmount = swapTokenTokenAmount;
            transactionMap[transactionId].timeoutTime = block.timestamp + transactionTimeoutDuration;
            transactionMap[transactionId].status = TransactionStatus.AWAITING_DELIVERY;

            emit EscrowDeposit(transactionId);
            userTokensMapping[msg.sender][tokenId] = tokenBalance;
            return transactionId;
        }
        address swapToken = tokens[swapTokenId];
        uint256 swapTokenBalance = userTokensMapping[transaction.sender][swapTokenId];

        if (transaction.status != TransactionStatus.AWAITING_DELIVERY)
            revert DepositFailure(DepositFailureReason.INVALID_STATE);

        if (swapTokenBalance < swapTokenTokenAmount)
            revert DepositFailure(DepositFailureReason.INSUFFICIENT_BALANCE);
        _pushTokens(msg.sender, swapToken, swapTokenTokenAmount);
        unchecked {
            swapTokenBalance = swapTokenBalance - swapTokenTokenAmount;
        }

        if (transaction.swapTokenAmount != tokenAmount)
            revert DepositFailure(DepositFailureReason.INSUFFICIENT_BALANCE);
        _sendTokens(msg.sender, transaction.sender, tokens[tokenId], tokenAmount);

        userTokensMapping[transaction.sender][swapTokenId] = swapTokenBalance;
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
            transaction.tokenId
        ];
        if (tokenBalance < transaction.tokenAmount)
            revert RefundFailure(RefundFailureReason.INSUFFICIENT_BALANCE);

        _pushTokens(
            transaction.sender,
            tokens[transaction.tokenId],
            transaction.tokenAmount
        );
        tokenBalance -= transaction.tokenAmount;
        userTokensMapping[transaction.sender][transaction.tokenId] = tokenBalance;
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
        uint tokenId
    ) external view returns (uint256) {
        return userTokensMapping[user][tokenId];
    }

    function getTokenIndex(address token) public view returns (int) {
        for (uint i = 0; i < tokens.length; i++) {
            if(tokens[i] == token) return int(i);
        }
        return -1;
    }

    function addToken(address token) external returns (uint256) {
        int tokenIndex = getTokenIndex(token);
        if(tokenIndex != -1) return uint(tokenIndex);
        tokens.push(token);
        return tokens.length - 1;
    }

    function tokensLength() public view returns (uint) {
        return tokens.length;
    }
}


