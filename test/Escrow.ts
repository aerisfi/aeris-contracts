import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { toUtf8Bytes } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { HashZero } from "@ethersproject/constants";
import { arrayify, BytesLike, concat, hexlify } from "@ethersproject/bytes";
import { MockERC20Token } from "../typechain-types";
import { Wallet } from "ethers";
import { setTimeout } from "timers/promises";

describe("Escrow", function () {
  async function setup() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy([]);

    const SendSimpleToken = await ethers.getContractFactory("MockERC20Token");
    const sendSimpleToken = await SendSimpleToken.deploy(
      "SendSimple",
      "SSYM",
      "10000000000000000000000"
    );

    const ReceiveSimpleToken = await ethers.getContractFactory(
      "MockERC20Token"
    );
    const receiveSimpleToken = await ReceiveSimpleToken.connect(
      otherAccount
    ).deploy("ReceiveSimple", "RSYM", "10000000000000000000000");

    await escrow.addTokens([
      sendSimpleToken.address,
      receiveSimpleToken.address,
    ]);
    const sendSimpleTokenId = 0;
    const receiveSimpleTokenId = 1;
    return {
      escrow: escrow,
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
  ): Promise<MockERC20Token> {
    const SimpleToken = await ethers.getContractFactory("MockERC20Token");
    const deployedToken = await SimpleToken.deploy(
      name,
      symbol,
      "10000000000000000000000"
    );
    return deployedToken;
  }

  async function deployEscrow(tokens: string[]) {
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(tokens);
    return escrow;
  }
  function bytes16(str: string): string {
    const bytes = toUtf8Bytes(str);
    return hexlify(concat([bytes, HashZero]).slice(0, 16));
  }

  const SEND_AMOUNT = 1_000_000;
  const RECEIVE_AMOUNT = 1_000_000;

  describe("marketOrder", function () {
    // it("Should throw exception on fetching the order", async function () {
    //   const {
    //     escrow,
    //     owner,
    //     sendSimpleToken,
    //     otherAccount,
    //     receiveSimpleToken,
    //   } = await loadFixture(setup);
    //   await expect(escrow.getOrder(bytes16("1"))).to.be.reverted;
    // });

    it("Should marketOrder an escrow amount", async function () {
      const {
        escrow,
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
      await sendSimpleToken.approve(escrow.address, sendAmount);
      const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      await escrow.marketOrder({
        orderId: orderId,
        sender: owner.address,
        outTokenAmount: receiveAmount,
        inTokenAmount: sendAmount,
        inTokenId: sendTokenId,
        outTokenId: receiveTokenId,
        orderType: 0,
      });

      const balanceAfterDeposit = await sendSimpleToken.balanceOf(
        owner.address
      );
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(0);
    });

    it("Should successfully complete peer to peer transfer", async function () {
      const {
        escrow,
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

      await sendSimpleToken.approve(escrow.address, SEND_AMOUNT);

      await escrow.marketOrder({
        orderId: orderId,
        sender: owner.address,
        outTokenAmount: RECEIVE_AMOUNT,
        inTokenAmount: SEND_AMOUNT,
        inTokenId: sendSimpleTokenId,
        outTokenId: receiveSimpleTokenId,
        orderType: 0,
      });
      let balanceAfterDeposit = await sendSimpleToken.balanceOf(owner.address);
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(0);

      const otherUserEscrow = escrow.connect(otherAccount);
      await receiveSimpleToken
        .connect(otherAccount)
        .approve(escrow.address, RECEIVE_AMOUNT);

      balanceBeforeDeposit = await receiveSimpleToken.balanceOf(
        otherAccount.address
      );

      await otherUserEscrow.marketOrder({
        orderId: orderId,
        sender: owner.address,
        outTokenAmount: RECEIVE_AMOUNT,
        inTokenAmount: SEND_AMOUNT,
        inTokenId: sendSimpleTokenId,
        outTokenId: receiveSimpleTokenId,
        orderType: 0,
      });
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

    it("Should revert duplicate orders", async function () {
      const {
        escrow,
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

      await sendSimpleToken.approve(escrow.address, SEND_AMOUNT);

      await escrow.marketOrder({
        orderId: orderId,
        sender: owner.address,
        outTokenAmount: RECEIVE_AMOUNT,
        inTokenAmount: SEND_AMOUNT,
        inTokenId: sendSimpleTokenId,
        outTokenId: receiveSimpleTokenId,
        orderType: 0,
      });

      let balanceAfterDeposit = await sendSimpleToken.balanceOf(owner.address);
      expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(0);

      await expect(
        escrow.marketOrder({
          orderId: orderId,
          sender: owner.address,
          outTokenAmount: RECEIVE_AMOUNT,
          inTokenAmount: SEND_AMOUNT,
          inTokenId: sendSimpleTokenId,
          outTokenId: receiveSimpleTokenId,
          orderType: 0,
        })
      ).to.be.reverted;
    });
  });

  //   describe("Cancel Order", function () {
  //     // Cancel Order tests
  //     it("Should cancel AWAITING_DELIVERY order", async function () {
  //       const {
  //         escrow,
  //         owner,
  //         sendSimpleToken,
  //         sendSimpleTokenId,
  //         receiveSimpleTokenId,
  //       } = await loadFixture(setup);
  //       const orderId = bytes16("1");
  //       const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
  //         owner.address
  //       );
  //       await sendSimpleToken.approve(escrow.address, SEND_AMOUNT);
  //       await escrow.marketOrder(
  //         sendSimpleTokenId,
  //         SEND_AMOUNT,
  //         receiveSimpleTokenId,
  //         RECEIVE_AMOUNT,
  //         orderId
  //       );
  //       const balanceAfterDeposit = await sendSimpleToken.balanceOf(
  //         owner.address
  //       );
  //       expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

  //       expect(
  //         await escrow.getOrder(orderId).then((tx) => tx.status)
  //       ).to.be.eq(0);

  //       await expect(escrow.cancelOrder(orderId))
  //         .to.emit(escrow, "CancelledOrder")
  //         .withArgs(orderId);
  //       const balanceAfterCancelOrder = await sendSimpleToken.balanceOf(
  //         owner.address
  //       );
  //       expect(balanceBeforeDeposit).equals(balanceAfterCancelOrder);
  //     });

  //     it("Should set order status to CANCELLED", async function () {
  //       const {
  //         escrow,
  //         owner,
  //         sendSimpleToken,
  //         sendSimpleTokenId,
  //         otherAccount,
  //         receiveSimpleToken,
  //         receiveSimpleTokenId,
  //       } = await loadFixture(setup);
  //       const receiverAddress = otherAccount.address;
  //       const orderId = bytes16("1");
  //       await sendSimpleToken.approve(escrow.address, SEND_AMOUNT);
  //       const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
  //         owner.address
  //       );
  //       await escrow.marketOrder(
  //         sendSimpleTokenId,
  //         SEND_AMOUNT,
  //         receiveSimpleTokenId,
  //         RECEIVE_AMOUNT,
  //         orderId
  //       );

  //       const balanceAfterDeposit = await sendSimpleToken.balanceOf(
  //         owner.address
  //       );
  //       expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

  //       await expect(escrow.cancelOrder(orderId))
  //         .to.emit(escrow, "CancelledOrder")
  //         .withArgs(orderId);
  //       // Ensure order status is CANCELLED.
  //       expect(
  //         await escrow.getOrder(orderId).then((tx) => tx.status)
  //       ).to.be.eq(3);
  //     });

  //     it("Should be cancelled only by order sender", async function () {
  //       const {
  //         escrow,
  //         owner,
  //         sendSimpleToken,
  //         sendSimpleTokenId,
  //         otherAccount,
  //         receiveSimpleToken,
  //         receiveSimpleTokenId,
  //       } = await loadFixture(setup);
  //       const receiverAddress = otherAccount.address;
  //       const orderId = bytes16("1");
  //       await sendSimpleToken.approve(escrow.address, SEND_AMOUNT);
  //       const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
  //         owner.address
  //       );

  //       await escrow.marketOrder(
  //         sendSimpleTokenId,
  //         SEND_AMOUNT,
  //         receiveSimpleTokenId,
  //         RECEIVE_AMOUNT,
  //         orderId
  //       );
  //       const balanceAfterDeposit = await sendSimpleToken.balanceOf(
  //         owner.address
  //       );
  //       expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(SEND_AMOUNT);

  //       // The order is being cancelled by a user other than the sender. So, this should be reverted
  //       await expect(escrow.connect(otherAccount).cancelOrder(orderId)).to.be
  //         .reverted;

  //       // Now the order is being cancelled by the sender. So, this should be successful
  //       await expect(escrow.cancelOrder(orderId))
  //         .to.emit(escrow, "CancelledOrder")
  //         .withArgs(orderId);
  //     });

  //     it("Can be cancelled by contract owner", async function () {
  //       const {
  //         escrow,
  //         owner,
  //         sendSimpleToken,
  //         sendSimpleTokenId,
  //         otherAccount,
  //         receiveSimpleToken,
  //         receiveSimpleTokenId,
  //       } = await loadFixture(setup);
  //       const orderId = bytes16("1");
  //       const sendTokenContract = receiveSimpleToken.connect(otherAccount)
  //       await sendTokenContract.approve(escrow.address, RECEIVE_AMOUNT);
  //       const balanceBeforeDeposit = await receiveSimpleToken.balanceOf(
  //         otherAccount.address
  //       );

  //       await escrow.connect(otherAccount).marketOrder(
  //         receiveSimpleTokenId,
  //         RECEIVE_AMOUNT,
  //         sendSimpleTokenId,
  //         SEND_AMOUNT,
  //         orderId
  //       );
  //       const balanceAfterDeposit = await receiveSimpleToken.balanceOf(
  //         otherAccount.address
  //       );
  //       expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(RECEIVE_AMOUNT);

  //       // The order is being cancelled by the contract owner. So, this should be successful
  //       await expect(escrow.cancelOrder(orderId))
  //         .to.emit(escrow, "CancelledOrder")
  //         .withArgs(orderId);
  //     });

  //     it("Should revert cancel order if already cancelled", async function () {
  //       const {
  //         escrow,
  //         owner,
  //         sendSimpleToken,
  //         sendSimpleTokenId,
  //         otherAccount,
  //         receiveSimpleToken,
  //         receiveSimpleTokenId,
  //       } = await loadFixture(setup);
  //       const receiverAddress = otherAccount.address;
  //       const orderId = bytes16("1");
  //       await escrow.setOrderTimeout(0);
  //       await sendSimpleToken.approve(escrow.address, SEND_AMOUNT * 2);
  //       const balanceBeforeDeposit = await sendSimpleToken.balanceOf(
  //         owner.address
  //       );

  //       await escrow.marketOrder(
  //         sendSimpleTokenId,
  //         SEND_AMOUNT,
  //         receiveSimpleTokenId,
  //         RECEIVE_AMOUNT,
  //         orderId
  //       );
  //       await escrow.marketOrder(
  //         sendSimpleTokenId,
  //         SEND_AMOUNT,
  //         receiveSimpleTokenId,
  //         RECEIVE_AMOUNT,
  //         bytes16("2")
  //       );
  //       const balanceAfterDeposit = await sendSimpleToken.balanceOf(
  //         owner.address
  //       );
  //       expect(balanceBeforeDeposit.sub(balanceAfterDeposit)).equals(
  //         2 * SEND_AMOUNT
  //       );

  //       await expect(escrow.cancelOrder(orderId))
  //         .to.emit(escrow, "CancelledOrder")
  //         .withArgs(orderId);
  //       await expect(escrow.cancelOrder(orderId)).to.be.reverted;
  //     });
  //   });

  describe("Add multiple tokens", function () {
    it("Should add multiple tokens", async function () {
      const totalTokensNum = 10;
      const tokens: string[] = [];
      for (let index = 0; index < totalTokensNum; index++) {
        tokens.push(Wallet.createRandom().address);
      }
      const escrow = await deployEscrow([]);

      await escrow.addTokens(tokens);
      for (let index = 0; index < tokens.length; index++) {
        expect(await escrow.getTokenIndex(tokens[index])).equals(index);
      }
    });
  });

  describe("getTokenIndex -- tests", function () {
    it("Should return -1 if searched for a token not added", async function () {
      const escrow = await deployEscrow([]);
      expect(await escrow.getTokenIndex(Wallet.createRandom().address)).equals(
        -1
      );
    });
  });

  describe("getTokenAddressByIndex -- tests", function () {
    it("Should return address given a valid index", async function () {
      const address = Wallet.createRandom().address;
      const escrow = await deployEscrow([address]);
      expect(await escrow.getTokenAddressByIndex(0)).equals(address);
    });
    it("Should revert if invalid id is given", async function () {
      const address = Wallet.createRandom().address;
      const escrow = await deployEscrow([address]);
      await expect(escrow.getTokenAddressByIndex(10)).to.be.reverted;
    });
  });

  describe("Only owner tests", function () {
    it("only contract owner should be able to add token", async function () {
      const {
        escrow,
        owner,
        sendSimpleToken,
        otherAccount,
        receiveSimpleToken,
      } = await loadFixture(setup);
      const tokens = [Wallet.createRandom().address];
      await escrow.addTokens(tokens);

      await expect(escrow.connect(otherAccount).addTokens(tokens)).to.be
        .reverted;
    });
  });
});
