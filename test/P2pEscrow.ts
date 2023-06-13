import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { toUtf8Bytes } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { HashZero } from "@ethersproject/constants";
import { arrayify, BytesLike, concat, hexlify } from "@ethersproject/bytes";

describe("P2PEscrow", function () {
  async function deployP2PEscrow() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();
    const P2PEscrow = await ethers.getContractFactory("P2PEscrow");
    const p2pEscrow = await P2PEscrow.deploy();

    const SendSimpleToken = await ethers.getContractFactory("SimpleToken");
    const sendSimpleToken = await SendSimpleToken.deploy(
      "SendSimple",
      "SSYM",
      "10000000000000000000000"
    );

    const ReceiveSimpleToken = await ethers.getContractFactory("SimpleToken");
    const receiveSimpleToken = await ReceiveSimpleToken.connect(
      otherAccount
    ).deploy("ReceiveSimple", "RSYM", "10000000000000000000000");

    await p2pEscrow.addToken(sendSimpleToken.address);
    await p2pEscrow.addToken(receiveSimpleToken.address);
    const sendSimpleTokenId = await p2pEscrow.getTokenIndex(
      sendSimpleToken.address
    );
    const receiveSimpleTokenId = await p2pEscrow.getTokenIndex(
      receiveSimpleToken.address
    );
    return {
      p2pEscrow,
      owner,
      sendSimpleToken,
      sendSimpleTokenId,
      otherAccount,
      receiveSimpleToken,
      receiveSimpleTokenId,
    };
  }

  function bytes16(str: string): string {
    const bytes = toUtf8Bytes(str);
    return hexlify(concat([bytes, HashZero]).slice(0, 16));
  }

  const SEND_AMOUNT = 1_000_000;
  const RECEIVE_AMOUNT = 1_000_000;

  describe("Deposit", function () {
    it("Should throw exception on fetching the transaction", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(deployP2PEscrow);
      await expect(p2pEscrow.getTransaction(bytes16("1"))).to.be.reverted;
    });

    it("Should deposit an escrow amount", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(deployP2PEscrow);
      const sendTokenId = sendSimpleTokenId;
      const sendAmount = 1000000;
      const receiveTokenId = receiveSimpleTokenId;
      const receiveAmount = 1000_000;
      const receiverAddress = otherAccount.address;
      const transactionId = bytes16("1");
      await sendSimpleToken.approve(p2pEscrow.address, sendAmount);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await p2pEscrow.deposit(
        sendTokenId,
        sendAmount,
        receiveTokenId,
        receiveAmount,
        transactionId
      );

      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(sendAmount);
    });

    it("Should successfully complete peer to peer transfer", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(deployP2PEscrow);

      const receiverAddress = otherAccount.address;
      const transactionId = bytes16("1");
      let balanceBeforeDeposit = await sendSimpleToken.balanceOf(owner.address);

      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      console.log(
        "gas estimate - user a deposits",
        await p2pEscrow.estimateGas.deposit(
          sendSimpleTokenId,
          SEND_AMOUNT,
          receiveSimpleTokenId,
          RECEIVE_AMOUNT,
          transactionId
        )
      );
      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        transactionId
      );

      let balanceAfterDeposit = await sendSimpleToken.balanceOf(owner.address);
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      const otherUserP2pEscrow = p2pEscrow.connect(otherAccount);
      await receiveSimpleToken
        .connect(otherAccount)
        .approve(p2pEscrow.address, RECEIVE_AMOUNT);

      balanceBeforeDeposit = await receiveSimpleToken.balanceOf(
        otherAccount.address
      );
      console.log(
        "gas estimate - user b deposits",
        await otherUserP2pEscrow.estimateGas.deposit(
          receiveSimpleTokenId,
          RECEIVE_AMOUNT,
          sendSimpleTokenId,
          SEND_AMOUNT,
          transactionId
        )
      );
      await otherUserP2pEscrow.deposit(
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        sendSimpleTokenId,
        SEND_AMOUNT,
        transactionId
      );
      balanceAfterDeposit = await receiveSimpleToken.balanceOf(
        otherAccount.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(
        RECEIVE_AMOUNT
      );

      expect(await sendSimpleToken.balanceOf(otherAccount.address)).equals(
        SEND_AMOUNT
      );
      expect(await receiveSimpleToken.balanceOf(owner.address)).equals(
        RECEIVE_AMOUNT
      );
    });
  });

  describe("Refund", function () {
    // Refund tests
    it("Should refund AWAITING_DELIVERY transaction", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = bytes16("1");
      await p2pEscrow.setTransactionTimeout(0);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        transactionId
      );
      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      expect(
        await p2pEscrow.getTransaction(transactionId).then((tx) => tx.status)
      ).to.be.eq(0);
      await expect(p2pEscrow.refund(transactionId))
        .to.emit(p2pEscrow, "RefundedTransaction")
        .withArgs(transactionId);
      const balanceAfterRefund = await sendSimpleToken.balanceOf(owner.address);
      expect(balanceBeforeDeposit).equals(balanceAfterRefund);
    });

    it("Should set transaction status to REFUNDED", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = bytes16("1");
      await p2pEscrow.setTransactionTimeout(0);
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        transactionId
      );

      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      await expect(p2pEscrow.refund(transactionId))
        .to.emit(p2pEscrow, "RefundedTransaction")
        .withArgs(transactionId);
      // Ensure transaction status is REFUNDED.
      expect(
        await p2pEscrow.getTransaction(transactionId).then((tx) => tx.status)
      ).to.be.eq(2);
    });

    it("Should revert refund if refunded before timeout period", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = bytes16("1");
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );

      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        transactionId
      );
      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      await expect(p2pEscrow.refund(transactionId)).to.be.reverted;
    });

    it("Should revert refund if already refunded", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = bytes16("1");
      await p2pEscrow.setTransactionTimeout(0);
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT * 2);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );

      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        transactionId
      );
      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        bytes16("2")
      );
      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(
        2 * SEND_AMOUNT
      );

      await expect(p2pEscrow.refund(transactionId))
        .to.emit(p2pEscrow, "RefundedTransaction")
        .withArgs(transactionId);
      await expect(p2pEscrow.refund(transactionId)).to.be.reverted;
    });
  });

  describe("Cancel Order", function () {
    // Cancel Order tests
    it("Should cancel AWAITING_DELIVERY transaction", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        receiveSimpleTokenId,
      } = await loadFixture(deployP2PEscrow);
      const transactionId = bytes16("1");
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        transactionId
      );
      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      expect(
        await p2pEscrow.getTransaction(transactionId).then((tx) => tx.status)
      ).to.be.eq(0);

      await expect(p2pEscrow.cancelOrder(transactionId))
        .to.emit(p2pEscrow, "CancelledOrder")
        .withArgs(transactionId);
      const balanceAfterCancelOrder = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit).equals(balanceAfterCancelOrder);
    });

    it("Should set transaction status to CANCELLED", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = bytes16("1");
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        transactionId
      );

      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      await expect(p2pEscrow.cancelOrder(transactionId))
        .to.emit(p2pEscrow, "CancelledOrder")
        .withArgs(transactionId);
      // Ensure transaction status is CANCELLED.
      expect(
        await p2pEscrow.getTransaction(transactionId).then((tx) => tx.status)
      ).to.be.eq(3);
    });

    it("Should be cancelled only by transaction sender", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = bytes16("1");
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );

      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        transactionId
      );
      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      // The transaction is being cancelled by a user other than the sender. So, this should be reverted
      await expect(p2pEscrow.connect(otherAccount).cancelOrder(transactionId)).to.be
        .reverted;

      // Now the transaction is being cancelled by the sender. So, this should be successful
      await expect(p2pEscrow.cancelOrder(transactionId))
        .to.emit(p2pEscrow, "CancelledOrder")
        .withArgs(transactionId);
    });

    it("Should revert cancel order if already refunded", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = bytes16("1");
      await p2pEscrow.setTransactionTimeout(0);
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT * 2);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );

      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        transactionId
      );
      await p2pEscrow.deposit(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        bytes16("2")
      );
      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(
        2 * SEND_AMOUNT
      );

      await expect(p2pEscrow.refund(transactionId))
        .to.emit(p2pEscrow, "RefundedTransaction")
        .withArgs(transactionId);
      await expect(p2pEscrow.cancelOrder(transactionId)).to.be.reverted;
    });

    it("Should revert cancel order if already cancelled", async function () {
        const {
          p2pEscrow,
          owner,
          sendSimpleToken,
          sendSimpleTokenId,
          otherAccount,
          receiveSimpleToken,
          receiveSimpleTokenId,
        } = await loadFixture(deployP2PEscrow);
        const receiverAddress = otherAccount.address;
        const transactionId = bytes16("1");
        await p2pEscrow.setTransactionTimeout(0);
        await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT * 2);
        const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
          owner.address
        );
  
        await p2pEscrow.deposit(
          sendSimpleTokenId,
          SEND_AMOUNT,
          receiveSimpleTokenId,
          RECEIVE_AMOUNT,
          transactionId
        );
        await p2pEscrow.deposit(
          sendSimpleTokenId,
          SEND_AMOUNT,
          receiveSimpleTokenId,
          RECEIVE_AMOUNT,
          bytes16("2")
        );
        const balanceAfterDeposit = await sendSimpleToken.balanceOf(
          owner.address
        );
        expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(
          2 * SEND_AMOUNT
        );
  
        await expect(p2pEscrow.cancelOrder(transactionId))
          .to.emit(p2pEscrow, "CancelledOrder")
          .withArgs(transactionId);
        await expect(p2pEscrow.cancelOrder(transactionId)).to.be.reverted;
      });
  });
});
