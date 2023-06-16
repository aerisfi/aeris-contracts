import { ethers } from "hardhat";

async function getTokens(): Promise<string[]> {
  return [];
}
async function deployP2PEscrow() {
  const tokens: string[] = await getTokens();
  const P2PEscrow = await ethers.getContractFactory("P2PEscrow");
  const p2pEscrowDeployment = await P2PEscrow.deploy(tokens);
  await p2pEscrowDeployment.deployed();
  console.log("P2pEscrow deployed to: ", p2pEscrowDeployment.address);
}
async function main() {
  deployP2PEscrow();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
