import { Contract } from "ethers";
import { ethers, run, tenderly } from "hardhat";

async function getTokens(): Promise<string[]> {
  return [
    // Ethereum coins
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
    "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
    "0x5a98fcbea516cf06857215779fd812ca3bef1b32", // LDO
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", // AAVE
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
    "0xd533a949740bb3306d119cc777fa900ba034cd52", // CRV
    "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", // MKR
    "0x163f8c2467924be0ae7b5347228cabf260318753", // WLD
    "0x4d224452801aced8b2f0aebe155379bb5d594381", // APE
    "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", // SHIB
    "0x6982508145454ce325ddbe47a25d4ec3d2311933", // PEPE
    "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", // MATIC

    // Avalanche coins
    // "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd", // JOE
    // "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", // USDT
    // "0x9C9e5fD8bbc25984B178FdCE6117Defa39d2db39", // BUSD
    // "0x62edc0692BD897D2295872a9FFCac5425011c661", // GMX
  ];
}
async function deployAndVerifyP2PEscrow() {
  const tokens: string[] = await getTokens();
  const P2PEscrow = await ethers.getContractFactory("P2PEscrow");
  const p2pEscrowDeployment = await P2PEscrow.deploy(tokens);
  const p2pEscrow = await p2pEscrowDeployment.deployed();
  const WAIT_BLOCK_CONFIRMATIONS = 6;
  await p2pEscrow.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);

  console.log("P2pEscrow deployed to: ", p2pEscrowDeployment.address);
  console.log(`Verifying contract on Etherscan...`);

  await run(`verify:verify`, {
    address: p2pEscrowDeployment.address,
    constructorArguments: [tokens],
  });
}

async function deployAndVerifyEscrow() {
  const tokens: string[] = await getTokens();
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrowDeployment = await Escrow.deploy(tokens);
  const escrow = await escrowDeployment.deployed();
  const WAIT_BLOCK_CONFIRMATIONS = 6;
  await escrow.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);

  console.log("Escrow deployed to: ", escrowDeployment.address);
  // console.log(`Verifying contract on Tenderly...`);

  // await tenderly.verify({
  //   address: escrowDeployment.address,
  //   name: "Escrow"
  // });

  // await run(`verify:verify`, {
  //   address: escrowDeployment.address,
  //   constructorArguments: [tokens],
  // });
}
async function verifyContract() {
  await run(`verify:verify`, {
    address: "0xc953c475a54BAf6A09838978032eE79D808ebA31",
    constructorArguments: [await getTokens()],
  });
}

async function deployContract(contractName:string, args: any[], libraries?:any): Promise<Contract> {
  const _contract = await ethers.getContractFactory(contractName, {
    libraries: libraries
  });
  console.log(`Deploying contract ${contractName}`);
  const contractDeployment = await _contract.deploy(...args);
  const contract = await contractDeployment.deployed();
  // const WAIT_BLOCK_CONFIRMATIONS = 6;
  await contract.deployTransaction.wait();
  // console.log(`Verifying ${contractName} contract on Tenderly...`);

  await tenderly.verify({
    address: contractDeployment.address,
    name: contractName
  });

  return contractDeployment;
}

async function deployAndVerifyAerisContractsOnTenderly() {
  // deploy pusherpuller library
  const pusherpuller = await deployContract("PullerPusher",[]);
  console.log("pusherpuller deployed to: ", pusherpuller.address);

  // aave banker deployment
  const mainnetAavePoolAddress = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
  const aaveBanker = await deployContract("AaveBanker", [mainnetAavePoolAddress], {
    PullerPusher: pusherpuller.address
  });
  console.log("aaveBanker deployed to: ", aaveBanker.address);

  // aerisWallet Deployment
    // Deploy 3 wallets
    const aerisWallets = [];
    for(let i=0; i< 3; i++){
      const aerisWallet = await deployContract("AerisWallet", []);
      aerisWallets.push(aerisWallet.address);
      console.log("deployed aerisWallet on ", aerisWallet.address);
    }

  // aerisWalletManager deployment
  const aerisWalletMgr = await deployContract("AerisWalletManager", [aaveBanker.address, aerisWallets])
  console.log("aerisWalletMgr deployed to: ", aerisWalletMgr.address);
  
  // LenderManager Deployment
  const uniswapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const routerV2 = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const allowedSourceTokens = ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"];
  const swapMappedTokens = ["0x83F20F44975D03b1b09e64809B757c47f942BEeA", "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"]
  const lenderManger = await deployContract("LenderManager", [aaveBanker.address, uniswapRouter, routerV2, allowedSourceTokens, swapMappedTokens], {
    PullerPusher: pusherpuller.address
  })
  console.log("lenderManger deployed to: ", lenderManger.address);

}
async function main() {
  // deployAndVerifyP2PEscrow();
  // deployAndVerifyEscrow();
  // verifyContract();

  deployAndVerifyAerisContractsOnTenderly();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
