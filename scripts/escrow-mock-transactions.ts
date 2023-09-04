/**
 * Pre-conditions: start a local forked chain using command: npx hardhat node
 * Deploy Escrow contract in the local forked chain and set the contract address in this file.
 *  Deploy using the command: npx hardhat run scripts/deploy.ts --network localhost
 * Run this file using the command: npx hardhat run scripts/escrow-mock-transactions.ts --network localhost

 */
import { ethers } from "hardhat";
import { getContractAt, getWhaleAt } from "./util/testUtil";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Interface, toUtf8Bytes } from "ethers/lib/utils";
import { concat, hexlify } from "@ethersproject/bytes";
import { HashZero } from "@ethersproject/constants";
import { BigNumber } from "ethers";

const USDTAddress = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const USDTWhaleAddress = "0x8A446971dbB112f3be15bc38C14D44B94D9E94b9";
const infinite_token_approval_amount =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935"; // 2^256 - 1
const tokenWhaleAddressMap: Map<string, string> = new Map([
  [
    "0x5a98fcbea516cf06857215779fd812ca3bef1b32", // LDO coin
    "0x9Bb75183646e2A0DC855498bacD72b769AE6ceD3", // LDO holding whale
  ],
  [
    "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
    "0x3F08f17973aB4124C73200135e2B675aB2D263D9",
  ],
  [
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
    "0x878f0822A9e77c1dD7883E543747147Be8D63C3B",
  ],
  [
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", // AAVE
    "0x3744DA57184575064838BBc87A0FC791F5E39eA2",
  ],
  [
    "0xd533a949740bb3306d119cc777fa900ba034cd52", // CRV
    "0xF977814e90dA44bFA03b6295A0616a897441aceC",
  ],
]);
const escrowContractAddress = "0xf201ffea8447ab3d43c98da3349e0749813c9009";
let tokenWhaleMap: Map<string, SignerWithAddress> = new Map();
function bytes16(str: string): string {
  const bytes = toUtf8Bytes(str);
  return hexlify(concat([bytes, HashZero]).slice(0, 16));
}
async function main() {
  // Impersonate some whales
  for (let [key, value] of tokenWhaleAddressMap) {
    const whale = await getWhaleAt(ethers, value);
    tokenWhaleMap.set(key, whale);
  }
  const usdtWhale = await getWhaleAt(ethers, USDTWhaleAddress)!;
  const escrowContract = await ethers.getContractAt(
    "Escrow",
    escrowContractAddress
  );
  const SELL_AMOUNT = "100000000"; // 100 followed by 6 zeroes
  const RECEIVE_AMOUNT = "100000000000000000000"; // 100 followed by 18 zeroes

  //   console.log("usdt whale balance", await usdtWhale.getBalance());
  //   // Give infinite approval for spending usdt by escrow from usdtwhale
  const usdtContract = await getContractAt(ethers, USDTAddress);
  //   const infiniteUsdtApproval = await usdtContract.connect(usdtWhale).approve(escrowContractAddress, infinite_token_approval_amount);
  //   console.log("infinite usdt approval", infiniteUsdtApproval);
  //   await infiniteUsdtApproval.wait();
  // Give infinite approval for spending token by escrow from tokenWhale
  const allowance = await usdtContract
    .connect(usdtWhale)
    .allowance(usdtWhale.address, escrowContractAddress);
  if (allowance < Number(infinite_token_approval_amount)) {
    console.log("Approving zero amount first");
    const zeroApprovalTx = await usdtContract
      .connect(usdtWhale)
      .approve(escrowContractAddress, infinite_token_approval_amount);
    await zeroApprovalTx.wait();

    console.log(
      "Giving infinite approval for the escrow contract to spend token"
    );
    const infiniteApprovalPT = await usdtContract.populateTransaction.approve(
      escrowContractAddress,
      infinite_token_approval_amount
    );
    const tokenApprovalTx = await usdtWhale.sendTransaction({
      to: infiniteApprovalPT.to,
      data: infiniteApprovalPT.data,
      gasLimit: BigNumber.from("100000"),
    });
    await tokenApprovalTx.wait();
  }

  const sellTokenId = await escrowContract
    .connect(usdtWhale)
    .getTokenIndex(USDTAddress);
  for (const tokenWhaleEntry of tokenWhaleMap) {
    const token = tokenWhaleEntry[0];
    const whale = tokenWhaleEntry[1];
    const orderId = bytes16(new Date().getTime().toString());
    const outTokenId = await escrowContract
      .connect(usdtWhale)
      .getTokenIndex(token);
    const orderQuote = {
      orderId: orderId,
      creator: usdtWhale.address,
      outTokenAmount: RECEIVE_AMOUNT,
      inTokenAmount: SELL_AMOUNT,
      inTokenId: sellTokenId,
      outTokenId: outTokenId,
      orderType: 0,
    };
    const tokenContract = await getContractAt(ethers, token);
    console.log("Token Name: ", await tokenContract.symbol());

    // place market order
    const marketOrderTx = await escrowContract
      .connect(usdtWhale)
      .marketOrder(orderQuote);
    // console.log("marketOrder Tx", marketOrderTx);
    const marketOrderTxReceipt = await marketOrderTx.wait();
    console.log(
      "market Order -- gas consumed: ",
      marketOrderTxReceipt.gasUsed.toString()
    );

    // Give infinite approval for spending token by escrow from tokenWhale
    const allowance = await tokenContract
      .connect(whale)
      .allowance(whale.address, escrowContractAddress);
    if (allowance < Number(infinite_token_approval_amount)) {
      console.log("Approving zero amount first");
      const zeroApprovalTx = await tokenContract
        .connect(whale)
        .approve(escrowContractAddress, infinite_token_approval_amount);
      await zeroApprovalTx.wait();

      console.log(
        "Giving infinite approval for the escrow contract to spend token"
      );
      const infiniteApprovalPT =
        await tokenContract.populateTransaction.approve(
          escrowContractAddress,
          infinite_token_approval_amount
        );
      const tokenApprovalTx = await whale.sendTransaction({
        to: infiniteApprovalPT.to,
        data: infiniteApprovalPT.data,
        gasLimit: BigNumber.from("100000"),
      });
      //   const tokenApprovalTx = await tokenContract
      //     .connect(whale)
      //     .approve(escrowContractAddress, infinite_token_approval_amount);
      await tokenApprovalTx.wait();
    }

    // Place serve order by the token whale
    const populatedTransaction = await escrowContract
      .connect(whale)
      .populateTransaction.serveOrder(orderQuote);
    const serveOrderTx = await whale.sendTransaction({
      to: populatedTransaction.to,
      data: populatedTransaction.data,
      gasLimit: BigNumber.from(1000000),
    });
    // console.log("serveOrder Tx", serveOrderTx);
    const txReceipt = await serveOrderTx.wait();
    console.log("serve Order -- gas consumed: ", txReceipt.gasUsed.toString());

    console.log(
      "-------------------------------------------------------------"
    );
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
