import * as tdly from "@tenderly/hardhat-tenderly";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "dotenv/config";
import "hardhat-deploy";
// import "@nomicfoundation/hardhat-verify";
import { getEnvVariable } from "./scripts/commons";
import "solidity-coverage";

const INFURA_API_KEY = getEnvVariable("INFURA_API_KEY");
const DEPLOYER_PRIVATE_KEY = getEnvVariable("DEPLOYER_PRIVATE_KEY");
const MNEMONIC = getEnvVariable("MNEMONIC");
const COIN_MARKETCAP_API_KEY = getEnvVariable("COIN_MARKETCAP_API_KEY");
const REPORT_GAS = getEnvVariable("REPORT_GAS");
const ETHERSCAN_API_KEY = getEnvVariable("ETHERSCAN_API_KEY");
const TENDERLY_PROJECT = getEnvVariable("TENDERLY_PROJECT");
const TENDERLY_USERNAME = getEnvVariable("TENDERLY_USERNAME");
tdly.setup({ automaticVerifications: true });


const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1,
      gasPrice: 21000000000,
      forking: {
        url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`
      }
    },
    eth_ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 10000000000,
    },
    eth_kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    eth_mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    avax_mainnet: {
      url: `https://avalanche-mainnet.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 26000000000,
    },
    eth_goerli: {
      url: `https://goerli.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    bsc_testnet: {
      url: "https://data-seed-prebsc-1-s3.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: { mnemonic: MNEMONIC },
    },
    tenderly: {
      chainId: 1,
      url: "https://rpc.tenderly.co/fork/f27120eb-1a64-46dc-920f-eb7b64833648"
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  tenderly: {
    project: process.env.TENDERLY_PROJECT ?? "",
    username: process.env.TENDERLY_USERNAME ?? "",
    privateVerification: true,
  },
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        // Toggles whether the optimizer is on or off.
        // It's good to keep it off for development
        // and turn on for when getting ready to launch.
        enabled: true,
        // The number of runs specifies roughly how often
        // the deployed code will be executed across the
        // life-time of the contract.
        runs: 300,
      },
    },
  },
  gasReporter: {
    outputFile: "gas-report.txt",
    enabled: REPORT_GAS !== undefined,
    currency: "USD",
    noColors: true,
    coinmarketcap: COIN_MARKETCAP_API_KEY,
    token: "ETH",
  },
};

export default config;
