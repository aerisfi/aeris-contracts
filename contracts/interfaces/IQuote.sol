// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title IQuote
 * @author Vamsi Krishna Srungarapu
 * @notice data structures supporting OrderQuote
 */
interface IQuote {
    enum OrderType {
        MARKET_ORDER,
        LIMIT_ORDER
    }
    struct OrderQuote {
        bytes16 orderId;
        address sender;
        uint96 outTokenAmount;
        uint96 inTokenAmount;
        uint16 inTokenId;
        uint16 outTokenId;
        OrderType orderType;
    }
    enum OrderStatus {
        UN_INITIATED,
        RECEIVED,
        FULFILLED,
        CANCELLED
    }
}
