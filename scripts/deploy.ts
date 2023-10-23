import { Contract } from "ethers";
import { ethers, run, tenderly } from "hardhat";

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
