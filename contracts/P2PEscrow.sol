// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract P2PEscrow {
    using SafeERC20 for IERC20;

    // Events emitted during the contract functions execution
    event EscrowDeposit(Transaction transaction);

    event SuccessfulTransaction(string transactionId);
    event RefundedTransaction(string transactionId);
    // End of Events

    enum TransactionStatus {
        AWAITING_DELIVERY,
        SUCCESS,
        REFUNDED
    }
    struct Transaction {
        string transactionId;
        address sender;
        address token;
        uint256 tokenAmount;
        address receiver;
        address receiverToken;
        uint256 receiverTokenAmount;
        uint256 timeoutTime;
        TransactionStatus status;
    }

    uint public transactionTimeoutDuration;
    mapping(address => mapping(address => uint256)) userTokensMapping;
    mapping(string => Transaction) transactionMap;

    constructor() {
        // Set default maturityTime period
        transactionTimeoutDuration = 100000;
    }

    function _pullTokens(address user, address asset, uint256 amount) private {
        if (asset == address(0)) return;
        // IERC20(asset).safeTransferFrom(user, address(this), amount);
    }

    function _pushTokens(address user, address asset, uint256 amount) private {
        if (asset == address(0)) return;
        // IERC20(asset).safeTransferFrom(address(this), user, amount);
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
        string memory transactionId
    ) external returns (string memory) {
        _pullTokens(msg.sender, token, tokenAmount);
        userTokensMapping[msg.sender][token] += tokenAmount;

        uint256 timeoutTime = block.timestamp + transactionTimeoutDuration;
        Transaction memory transaction = transactionMap[transactionId];
        if (transaction.sender == address(0)) {
            transaction = Transaction({
                transactionId: transactionId,
                sender: msg.sender,
                token: token,
                tokenAmount: tokenAmount,
                receiver: receiver,
                receiverToken: receiverToken,
                receiverTokenAmount: receiverTokenAmount,
                timeoutTime: timeoutTime,
                status: TransactionStatus.AWAITING_DELIVERY
            });
            transactionMap[transactionId] = transaction;
            emit EscrowDeposit(transaction);
            return transactionId;
        }
        
        require(
            transaction.status == TransactionStatus.AWAITING_DELIVERY,
            "forTransaction can be processed only if it's status is AWAITING_DELIVERY"
        );
        require(
            userTokensMapping[receiver][receiverToken] >= receiverTokenAmount,
            "peer did not deposit enough tokens"
        );
        _pushTokens(msg.sender, receiverToken, receiverTokenAmount);
        userTokensMapping[receiver][receiverToken] -= receiverTokenAmount;

        require(
            transaction.receiverTokenAmount == tokenAmount,
            "you did not deposit enough token for p2p transaction to be successful"
        );
        _pushTokens(receiver, token, tokenAmount);
        userTokensMapping[msg.sender][token] -= tokenAmount;

        transaction.status = TransactionStatus.SUCCESS;
        transactionMap[transactionId] = transaction;

        emit SuccessfulTransaction(transactionId);

        return transactionId;
    }

    function refund(string memory transactionId) external {
        Transaction memory transaction = transactionMap[transactionId];
        require(
            block.timestamp > transaction.timeoutTime,
            "transaction can be refunded only after its timeout period"
        );
        require(
            transaction.status == TransactionStatus.AWAITING_DELIVERY,
            "transaction can be refunded only if it is awaiting delivery"
        );
        require(
            userTokensMapping[transaction.sender][transaction.token] > 0,
            "user token balance for the transaction should be non zero"
        );

        _pushTokens(
            transaction.sender,
            transaction.token,
            transaction.tokenAmount
        );
        userTokensMapping[transaction.sender][transaction.token] -= transaction
            .tokenAmount;
        transaction.status = TransactionStatus.REFUNDED;
        transactionMap[transactionId] = transaction;

        emit RefundedTransaction(transactionId);
    }

    function getTransaction(
        string memory transactionId
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
