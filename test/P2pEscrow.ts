import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

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

    return {
      p2pEscrow,
      owner,
      sendSimpleToken,
      otherAccount,
      receiveSimpleToken,
    };
  }

  function stringToBytes16(str: string): Uint8Array {
    const bytes = new Uint8Array(16);

    for (let i = 0; i < Math.min(str.length, 16); i++) {
      const charCode = str.charCodeAt(i);
      bytes[i] = charCode;
    }

    return bytes;
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
      await expect(
        p2pEscrow.getTransaction("0x31000000000000000000000000000000")
      ).to.be.reverted;
    });

    it("Should deposit an escrow amount", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(deployP2PEscrow);
      const sendToken = sendSimpleToken.address;
      const sendAmount = 1000000;
      const receiveToken = receiveSimpleToken.address;
      const receiveAmount = 1000_000;
      const receiverAddress = otherAccount.address;
      const transactionId = "0x31000000000000000000000000000000";
      await sendSimpleToken.approve(p2pEscrow.address, sendAmount);
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
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(deployP2PEscrow);

      const receiverAddress = otherAccount.address;
      const transactionId = "0x31000000000000000000000000000000";
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      console.log(
        "gas estimate - user a deposits",
        await p2pEscrow.estimateGas.deposit(
          sendSimpleToken.address,
          SEND_AMOUNT,
          receiveSimpleToken.address,
          RECEIVE_AMOUNT,
          receiverAddress,
          transactionId
        )
      );
      await p2pEscrow.deposit(
        sendSimpleToken.address,
        SEND_AMOUNT,
        receiveSimpleToken.address,
        RECEIVE_AMOUNT,
        receiverAddress,
        transactionId
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, sendSimpleToken.address)
      ).to.be.eq(SEND_AMOUNT);

      const otherUserP2pEscrow = p2pEscrow.connect(otherAccount);
      await receiveSimpleToken
        .connect(otherAccount)
        .approve(p2pEscrow.address, RECEIVE_AMOUNT);

      console.log(
        "gas estimate - user b deposits",
        await otherUserP2pEscrow.estimateGas.deposit(
          receiveSimpleToken.address,
          RECEIVE_AMOUNT,
          sendSimpleToken.address,
          SEND_AMOUNT,
          owner.address,
          transactionId
        )
      );
      await otherUserP2pEscrow.deposit(
        receiveSimpleToken.address,
        RECEIVE_AMOUNT,
        sendSimpleToken.address,
        SEND_AMOUNT,
        owner.address,
        transactionId
      );
      expect(
        await otherUserP2pEscrow.getUserBalances(
          otherAccount.address,
          receiveSimpleToken.address
        )
      ).to.be.eq(0);
      expect(
        await p2pEscrow.getUserBalances(owner.address, sendSimpleToken.address)
      ).to.be.eq(0);
    });

    it("Should refund AWAITING_DELIVERY transaction", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = "0x31000000000000000000000000000000";
      await p2pEscrow.setTransactionTimeout(0);
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      await p2pEscrow.deposit(
        sendSimpleToken.address,
        SEND_AMOUNT,
        receiveSimpleToken.address,
        RECEIVE_AMOUNT,
        receiverAddress,
        transactionId
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, sendSimpleToken.address)
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
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = "0x31000000000000000000000000000000";
      await p2pEscrow.setTransactionTimeout(0);
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      await p2pEscrow.deposit(
        sendSimpleToken.address,
        SEND_AMOUNT,
        receiveSimpleToken.address,
        RECEIVE_AMOUNT,
        receiverAddress,
        transactionId
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, sendSimpleToken.address)
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
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = "0x31000000000000000000000000000000";
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      await p2pEscrow.deposit(
        sendSimpleToken.address,
        SEND_AMOUNT,
        receiveSimpleToken.address,
        RECEIVE_AMOUNT,
        receiverAddress,
        transactionId
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, sendSimpleToken.address)
      ).to.be.eq(SEND_AMOUNT);
      await expect(p2pEscrow.refund(transactionId)).to.be.reverted;
    });

    it("Should revert refund if already refunded", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(deployP2PEscrow);
      const receiverAddress = otherAccount.address;
      const transactionId = "0x31000000000000000000000000000000";
      await p2pEscrow.setTransactionTimeout(0);
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT * 2);
      await p2pEscrow.deposit(
        sendSimpleToken.address,
        SEND_AMOUNT,
        receiveSimpleToken.address,
        RECEIVE_AMOUNT,
        receiverAddress,
        transactionId
      );
      await p2pEscrow.deposit(
        sendSimpleToken.address,
        SEND_AMOUNT,
        receiveSimpleToken.address,
        RECEIVE_AMOUNT,
        receiverAddress,
        "0x32000000000000000000000000000000"
      );
      expect(
        await p2pEscrow.getUserBalances(owner.address, sendSimpleToken.address)
      ).to.be.eq(SEND_AMOUNT * 2);
      await expect(p2pEscrow.refund(transactionId))
        .to.emit(p2pEscrow, "RefundedTransaction")
        .withArgs(transactionId);
      await expect(p2pEscrow.refund(transactionId)).to.be.reverted;
    });
  });
});
