import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { toUtf8Bytes } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { HashZero } from "@ethersproject/constants";
import { arrayify, BytesLike, concat, hexlify } from "@ethersproject/bytes";
import { SimpleToken } from "../typechain-types";
import { Wallet } from "ethers";

describe("P2PEscrow", function () {
  async function setup() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();
    const P2PEscrow = await ethers.getContractFactory("P2PEscrow");
    const p2pEscrow = await P2PEscrow.deploy([]);

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

    await p2pEscrow.addTokens([
      sendSimpleToken.address,
      receiveSimpleToken.address,
    ]);
    const sendSimpleTokenId = 0;
    const receiveSimpleTokenId = 1;
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

  async function deployAndGetToken(
    name: string,
    symbol: string
  ): Promise<SimpleToken> {
    const SimpleToken = await ethers.getContractFactory("SimpleToken");
    const deployedToken = await SimpleToken.deploy(
      name,
      symbol,
      "10000000000000000000000"
    );
    return deployedToken;
  }

  async function deployP2pEscrow(tokens: string[]) {
    const P2PEscrow = await ethers.getContractFactory("P2PEscrow");
    const p2pEscrow = await P2PEscrow.deploy(tokens);
    return p2pEscrow;
  }
  function bytes16(str: string): string {
    const bytes = toUtf8Bytes(str);
    return hexlify(concat([bytes, HashZero]).slice(0, 16));
  }

  const SEND_AMOUNT = 1_000_000;
  const RECEIVE_AMOUNT = 1_000_000;

  describe("marketOrder", function () {
    it("Should throw exception on fetching the order", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(setup);
      await expect(p2pEscrow.getOrder(bytes16("1"))).to.be.reverted;
    });

    it("Should marketOrder an escrow amount", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(setup);
      const sendTokenId = sendSimpleTokenId;
      const sendAmount = 1000000;
      const receiveTokenId = receiveSimpleTokenId;
      const receiveAmount = 1000_000;
      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      await sendSimpleToken.approve(p2pEscrow.address, sendAmount);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await p2pEscrow.marketOrder(
        sendTokenId,
        sendAmount,
        receiveTokenId,
        receiveAmount,
        orderId
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
      } = await loadFixture(setup);

      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      let balanceBeforeDeposit = await sendSimpleToken.balanceOf(owner.address);

      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      console.log(
        "gas estimate - user a deposits",
        await p2pEscrow.estimateGas.marketOrder(
          sendSimpleTokenId,
          SEND_AMOUNT,
          receiveSimpleTokenId,
          RECEIVE_AMOUNT,
          orderId
        )
      );
      await p2pEscrow.marketOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        orderId
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
        await otherUserP2pEscrow.estimateGas.marketOrder(
          receiveSimpleTokenId,
          RECEIVE_AMOUNT,
          sendSimpleTokenId,
          SEND_AMOUNT,
          orderId
        )
      );
      await otherUserP2pEscrow.marketOrder(
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        sendSimpleTokenId,
        SEND_AMOUNT,
        orderId
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

  describe("limitOrder", function () {
    it("Should throw exception on fetching the order", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(setup);
      await expect(p2pEscrow.getOrder(bytes16("1"))).to.be.reverted;
    });

    it("Should limitOrder an escrow amount", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(setup);
      const sendTokenId = sendSimpleTokenId;
      const sendAmount = 1000000;
      const receiveTokenId = receiveSimpleTokenId;
      const receiveAmount = 1000_000;
      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      await sendSimpleToken.approve(p2pEscrow.address, sendAmount);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await p2pEscrow.limitOrder(
        sendTokenId,
        sendAmount,
        receiveTokenId,
        receiveAmount,
        Math.round(new Date().getTime() / 1000) + 300,
        orderId
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
      } = await loadFixture(setup);

      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      let balanceBeforeDeposit = await sendSimpleToken.balanceOf(owner.address);

      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);

      await p2pEscrow.limitOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        Math.round(new Date().getTime() / 1000) + 300,
        orderId
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

      await otherUserP2pEscrow.limitOrder(
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        sendSimpleTokenId,
        SEND_AMOUNT,
        Math.round(new Date().getTime() / 1000) + 300,
        orderId
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
    it("Should refund AWAITING_DELIVERY order", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(setup);
      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      await p2pEscrow.setOrderTimeout(0);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      await p2pEscrow.marketOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        orderId
      );
      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      expect(
        await p2pEscrow.getOrder(orderId).then((tx) => tx.status)
      ).to.be.eq(0);
      await expect(p2pEscrow.refund(orderId))
        .to.emit(p2pEscrow, "RefundedOrder")
        .withArgs(orderId);
      const balanceAfterRefund = await sendSimpleToken.balanceOf(owner.address);
      expect(balanceBeforeDeposit).equals(balanceAfterRefund);
    });

    it("Should set order status to REFUNDED", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(setup);
      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      await p2pEscrow.setOrderTimeout(0);
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await p2pEscrow.marketOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        orderId
      );

      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      await expect(p2pEscrow.refund(orderId))
        .to.emit(p2pEscrow, "RefundedOrder")
        .withArgs(orderId);
      // Ensure order status is REFUNDED.
      expect(
        await p2pEscrow.getOrder(orderId).then((tx) => tx.status)
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
      } = await loadFixture(setup);
      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );

      await p2pEscrow.marketOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        orderId
      );
      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      await expect(p2pEscrow.refund(orderId)).to.be.reverted;
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
      } = await loadFixture(setup);
      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      await p2pEscrow.setOrderTimeout(0);
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT * 2);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );

      await p2pEscrow.marketOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        orderId
      );
      await p2pEscrow.marketOrder(
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

      await expect(p2pEscrow.refund(orderId))
        .to.emit(p2pEscrow, "RefundedOrder")
        .withArgs(orderId);
      await expect(p2pEscrow.refund(orderId)).to.be.reverted;
    });
  });

  describe("Cancel Order", function () {
    // Cancel Order tests
    it("Should cancel AWAITING_DELIVERY order", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        receiveSimpleTokenId,
      } = await loadFixture(setup);
      const orderId = bytes16("1");
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      await p2pEscrow.marketOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        orderId
      );
      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      expect(
        await p2pEscrow.getOrder(orderId).then((tx) => tx.status)
      ).to.be.eq(0);

      await expect(p2pEscrow.cancelOrder(orderId))
        .to.emit(p2pEscrow, "CancelledOrder")
        .withArgs(orderId);
      const balanceAfterCancelOrder = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit).equals(balanceAfterCancelOrder);
    });

    it("Should set order status to CANCELLED", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(setup);
      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await p2pEscrow.marketOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        orderId
      );

      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      await expect(p2pEscrow.cancelOrder(orderId))
        .to.emit(p2pEscrow, "CancelledOrder")
        .withArgs(orderId);
      // Ensure order status is CANCELLED.
      expect(
        await p2pEscrow.getOrder(orderId).then((tx) => tx.status)
      ).to.be.eq(3);
    });

    it("Should be cancelled only by order sender", async function () {
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        sendSimpleTokenId,
        otherAccount,
        receiveSimpleToken,
        receiveSimpleTokenId,
      } = await loadFixture(setup);
      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );

      await p2pEscrow.marketOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        orderId
      );
      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

      // The order is being cancelled by a user other than the sender. So, this should be reverted
      await expect(p2pEscrow.connect(otherAccount).cancelOrder(orderId)).to.be
        .reverted;

      // Now the order is being cancelled by the sender. So, this should be successful
      await expect(p2pEscrow.cancelOrder(orderId))
        .to.emit(p2pEscrow, "CancelledOrder")
        .withArgs(orderId);
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
      } = await loadFixture(setup);
      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      await p2pEscrow.setOrderTimeout(0);
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT * 2);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );

      await p2pEscrow.marketOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        orderId
      );
      await p2pEscrow.marketOrder(
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

      await expect(p2pEscrow.refund(orderId))
        .to.emit(p2pEscrow, "RefundedOrder")
        .withArgs(orderId);
      await expect(p2pEscrow.cancelOrder(orderId)).to.be.reverted;
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
      } = await loadFixture(setup);
      const receiverAddress = otherAccount.address;
      const orderId = bytes16("1");
      await p2pEscrow.setOrderTimeout(0);
      await sendSimpleToken.approve(p2pEscrow.address, SEND_AMOUNT * 2);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );

      await p2pEscrow.marketOrder(
        sendSimpleTokenId,
        SEND_AMOUNT,
        receiveSimpleTokenId,
        RECEIVE_AMOUNT,
        orderId
      );
      await p2pEscrow.marketOrder(
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

      await expect(p2pEscrow.cancelOrder(orderId))
        .to.emit(p2pEscrow, "CancelledOrder")
        .withArgs(orderId);
      await expect(p2pEscrow.cancelOrder(orderId)).to.be.reverted;
    });
  });

  describe("Deploy P2PEscrow with 1000 tokens", function () {
    it("Should add multiple tokens", async function () {
      const totalTokensNum = 1000;
      const tokens: string[] = [];
      for (let index = 0; index < totalTokensNum; index++) {
        tokens.push(Wallet.createRandom().address);
      }
      const p2pEscrow = await deployP2pEscrow(tokens);
    });
  });

  describe("Add 500 tokens", function () {
    it("Should add multiple tokens", async function () {
      const totalTokensNum = 500;
      const tokens: string[] = [];
      for (let index = 0; index < totalTokensNum; index++) {
        tokens.push(Wallet.createRandom().address);
      }
      const p2pEscrow = await deployP2pEscrow([]);

      await p2pEscrow.addTokens(tokens);
    });
  });

  describe("Only owner tests", function() {
    it("only contract owner should be able to set the order timeout", async function(){
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(setup);
      await p2pEscrow.setOrderTimeout(600);

      await expect(p2pEscrow.connect(otherAccount).setOrderTimeout(300)).to.be.reverted;
    });
    it("only contract owner should be able to add token", async function(){
      const {
        p2pEscrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(setup);
      const tokens= [Wallet.createRandom().address];
      await p2pEscrow.addTokens(tokens);

      await expect(p2pEscrow.connect(otherAccount).addTokens(tokens)).to.be.reverted;
    });
  });
});
