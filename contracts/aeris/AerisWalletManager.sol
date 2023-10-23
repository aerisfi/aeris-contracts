// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import "./interfaces/IBanker.sol";
import "./AerisWallet.sol";

contract AerisWalletManager {
    IBanker banker;
    mapping(address => address) borrowerWalletsMap;
    address[] availableAerisWalletAddress;
    uint availableAerisWalletIndex;
    constructor(address _banker, address[] memory _availableAerisWalletAddress) {
        banker = IBanker(_banker);
        for (uint i = 0; i < _availableAerisWalletAddress.length; i++) {
            availableAerisWalletAddress.push(_availableAerisWalletAddress[i]);
        }
    }

    function createWalletForUser(address user) internal returns(address) {
        address aerisWalletAddress = availableAerisWalletAddress[availableAerisWalletIndex];
        delete availableAerisWalletAddress[availableAerisWalletIndex];
        availableAerisWalletIndex++;
        borrowerWalletsMap[user] = aerisWalletAddress;
        return aerisWalletAddress;
    }
    function borrow(address asset, uint256 amount) external {
        address walletAddress = borrowerWalletsMap[msg.sender];
        if(walletAddress == address(0)) {
            walletAddress = createWalletForUser(msg.sender);
        }
        AerisWallet wallet = AerisWallet(walletAddress);
        banker.borrow(asset, amount, walletAddress);
        wallet.addBorrowAmount(asset, amount);
    }
    function getBorrowedAmount(address token, address user) external view returns (uint256) {
        address borrowerWallet = borrowerWalletsMap[user];
        if(borrowerWallet == address(0)) return 0;
        AerisWallet wallet = AerisWallet(borrowerWallet);
        return wallet.getBorrowedAmount(token);
    }
    function withdraw(address token, uint256 amount) external {
        revert("withdraw disabled");

    }
    function getUserWallet(address user) external view returns(address) {
        return borrowerWalletsMap[user];
    }
}