import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { P2PEscrow, P2PEscrow__factory } from "../typechain-types";

describe("P2PEscrow", function () {
  async function deployP2PEscrow() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const P2PEscrow = await ethers.getContractFactory("P2PEscrow");
    const p2pEscrow = await P2PEscrow.deploy();

    return { p2pEscrow, owner, otherAccount };
  }

  const SEND_AMOUNT = 1_000_000;
  const RECEIVE_AMOUNT = 1_000_000;
  const SEND_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const RECEIVE_TOKEN = "0x16931d94c6F082feFB2b07df1C6dd7CAFc1839b5";

  describe("Deposit", function () {
    it("Should throw exception on fetching the transaction", async function () {
      const { p2pEscrow, owner, otherAccount } = await loadFixture(
        deployP2PEscrow
      );
      await expect(p2pEscrow.getTransaction("0")).to.be.revertedWith(
        "invalid transaction id"
      );
    });

    it("Should deposit an escrow amount", async function () {
      const { p2pEscrow, owner, otherAccount } = await loadFixture(
        deployP2PEscrow
      );
      const sendToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const sendAmount = 1000000;
      const receiveToken = "0x16931d94c6F082feFB2b07df1C6dd7CAFc1839b5";
      const receiveAmount = 1000_000;
      const receiverAddress = otherAccount.address;
      const transactionId = "1";
      await p2pEscrow.deposit(
        sendToken,
        sendAmount,
        receiveToken,
        receiveAmount,
        receiverAddress,
        transactionId
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, sendToken)
      ).to.be.eq(sendAmount);
    });

    it("Should successfully complete peer to peer transfer", async function () {
      const { p2pEscrow, owner, otherAccount } = await loadFixture(
        deployP2PEscrow
      );

      const receiverAddress = otherAccount.address;
      const transactionId = "1";
      await p2pEscrow.deposit(
        SEND_TOKEN,
        SEND_AMOUNT,
        RECEIVE_TOKEN,
        RECEIVE_AMOUNT,
        receiverAddress,
        transactionId
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, SEND_TOKEN)
      ).to.be.eq(SEND_AMOUNT);
      const otherUserP2pEscrow = p2pEscrow.connect(otherAccount);
      await otherUserP2pEscrow.deposit(
        RECEIVE_TOKEN,
        RECEIVE_AMOUNT,
        SEND_TOKEN,
        SEND_AMOUNT,
        owner.address,
        transactionId
      );
      expect(
        await otherUserP2pEscrow.getUserBalances(
          otherAccount.address,
          RECEIVE_TOKEN
        )
      ).to.be.eq(0);
      expect(
        await p2pEscrow.getUserBalances(owner.address, SEND_TOKEN)
      ).to.be.eq(0);
    });

    it("Should refund AWAITING_DELIVERY transaction", async function () {
      const { p2pEscrow, owner, otherAccount } = await loadFixture(
        deployP2PEscrow
      );
      const receiverAddress = otherAccount.address;
      const transactionId = "1";
      await p2pEscrow.setTransactionTimeout(0);
      await p2pEscrow.deposit(
        SEND_TOKEN,
        SEND_AMOUNT,
        RECEIVE_TOKEN,
        RECEIVE_AMOUNT,
        receiverAddress,
        transactionId
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, SEND_TOKEN)
      ).to.be.eq(SEND_AMOUNT);
      // Ensure Transaction status is AWAITING_DELIVERY
      expect(
        await p2pEscrow.getTransaction(transactionId).then((tx) => tx.status)
      ).to.be.eq(0);
      await expect(p2pEscrow.refund(transactionId))
        .to.emit(p2pEscrow, "RefundedTransaction")
        .withArgs(transactionId);
    });

    it("Should set transaction status to REFUNDED", async function () {
      const { p2pEscrow, owner, otherAccount } = await loadFixture(
        deployP2PEscrow
      );
      const receiverAddress = otherAccount.address;
      const transactionId = "1";
      await p2pEscrow.setTransactionTimeout(0);
      await p2pEscrow.deposit(
        SEND_TOKEN,
        SEND_AMOUNT,
        RECEIVE_TOKEN,
        RECEIVE_AMOUNT,
        receiverAddress,
        transactionId
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, SEND_TOKEN)
      ).to.be.eq(SEND_AMOUNT);
      await expect(p2pEscrow.refund(transactionId))
        .to.emit(p2pEscrow, "RefundedTransaction")
        .withArgs(transactionId);
      // Ensure transaction status is REFUNDED.
      expect(
        await p2pEscrow.getTransaction(transactionId).then((tx) => tx.status)
      ).to.be.eq(2);
    });

    it("Should revert refund if refunded before timeout period", async function () {
      const { p2pEscrow, owner, otherAccount } = await loadFixture(
        deployP2PEscrow
      );
      const receiverAddress = otherAccount.address;
      const transactionId = "1";
      await p2pEscrow.deposit(
        SEND_TOKEN,
        SEND_AMOUNT,
        RECEIVE_TOKEN,
        RECEIVE_AMOUNT,
        receiverAddress,
        transactionId
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, SEND_TOKEN)
      ).to.be.eq(SEND_AMOUNT);
      await expect(p2pEscrow.refund(transactionId)).to.be.revertedWith(
        "transaction can be refunded only after its timeout period"
      );
    });

    it("Should revert refund if already refunded", async function () {
      const { p2pEscrow, owner, otherAccount } = await loadFixture(
        deployP2PEscrow
      );
      const receiverAddress = otherAccount.address;
      const transactionId = "1";
      await p2pEscrow.setTransactionTimeout(0);
      await p2pEscrow.deposit(
        SEND_TOKEN,
        SEND_AMOUNT,
        RECEIVE_TOKEN,
        RECEIVE_AMOUNT,
        receiverAddress,
        transactionId
      );
      await p2pEscrow.deposit(
        SEND_TOKEN,
        SEND_AMOUNT,
        RECEIVE_TOKEN,
        RECEIVE_AMOUNT,
        receiverAddress,
        "new-tx-id"
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, SEND_TOKEN)
      ).to.be.eq(SEND_AMOUNT * 2);
      await expect(p2pEscrow.refund(transactionId))
        .to.emit(p2pEscrow, "RefundedTransaction")
        .withArgs(transactionId);
      await expect(p2pEscrow.refund(transactionId)).to.be.revertedWith(
        "transaction can be refunded only if it is awaiting delivery"
      );
    });
  });
});
