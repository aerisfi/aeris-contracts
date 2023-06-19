# 1Click - Smart Contracts
This project contains the smart contracts developed by 1Click.

## P2PEscrow.sol
This contract helps in completing a peer to peer token transfer envisioned as a market order or limit order.
This contract has primarily 3 major functionalities:
1. marketOrder
    A user creates a market order specifying the token and its corresponding token amount he is ready to sell. User also specifies the token and token amount he wants to purchase.
    This market order can be served by a different user who is willing to trade according to the order creators rates.
    This order stays alive for a default of 300 seconds.
2. limitOrder
    limitOrder functionality is similar to that of a market order. Only difference between limit order and market order is a user will be able to specify the order expiry time in case of limit order
3. cancelOrder
    Only a order creator will have the right to cancel the order and this order will not be available to serve further by any willing market makers.
4. refund
    After the expiry of market/limit order, anyone can initiate the refund functionality to deposit the order amount back to order creators wallet.

## Installation
This project is developed with node version: v19.7.0 and npm version: 9.5.0
```shell
npm install
```
- Run `npx hardhat` compile for compiling the solidity file
- Run `npx hardhat test` for running the unit tests
- Run `slither .` to run the static code analysis
- Run `npx hardhat coverage` for running the test coverage

## Helper Tasks
```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts --network <network_name> // to deploy the smart contract
```
