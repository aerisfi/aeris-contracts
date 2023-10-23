# Aeris - Smart Contracts
This project contains the smart contracts developed for lending and borrowing through aeris.

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
