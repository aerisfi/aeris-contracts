import { HardhatEthersHelpers } from "@nomiclabs/hardhat-ethers/types";
import { constants } from "ethers";

// Others
const ZERO_ADDRESS = constants.AddressZero;
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // USDC on mainnet
const IERC20_SOURCE = "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20";
const ibEURPoolWhaleAddr = "0xA6c679d98683D9f65815Dc8568d3C05236166942";
// const ibEURPoolWhaleAddr = "0xB0EE73c960a418e0445CCd25A2997225f103c279";

export function usdcWhale(ethers: HardhatEthersHelpers) {
  return ethers.getSigner("0x7713974908Be4BEd47172370115e8b1219F4A5f0");
}

export function wethWhale(ethers: HardhatEthersHelpers) {
  return ethers.getSigner("0x06920C9fC643De77B99cB7670A944AD31eaAA260");
}

export function getEthWhale(ethers: HardhatEthersHelpers) {
  return ethers.getSigner("0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503");
}
export function getWBTCWhale(ethers: HardhatEthersHelpers) {
  return ethers.getSigner("0xaB7b99998206D1ccf8B13b02b7566C267F4e2313")
}
export async function getAvaxWhale(ethers: HardhatEthersHelpers) {
  let [avaxWhale] = await ethers.provider.listAccounts();
  return ethers.getSigner(avaxWhale);
}
export async function getNativeTokenWhale(ethers: HardhatEthersHelpers) {
  let [nativeTokenWhale] = await ethers.provider.listAccounts();
  return ethers.getImpersonatedSigner(nativeTokenWhale);
}
export async function getUsdcWhaleOnAvalanche(ethers: HardhatEthersHelpers) {
  return ethers.getSigner("0xA465900f5eb9aACdBAC1b956Fd7045D02b4370d4");
}

export async function getWhaleAt(ethers: HardhatEthersHelpers, whaleAddress: string) {
  return ethers.getImpersonatedSigner(whaleAddress);
}
export async function getSavaxWhaleOnAvalanche(ethers: HardhatEthersHelpers) {
  return ethers.getSigner("0x8B3D19047c35AF317A4393483a356762bEeC69A5");
}
export function getIBEURWhale(ethers: HardhatEthersHelpers) {
  return ethers.getSigner(ibEURPoolWhaleAddr);
}
export async function usdcContract(ethers: HardhatEthersHelpers) {
  return ethers.getContractAt(IERC20_SOURCE, USDC_ADDRESS);
}

export async function getContractAt(
  ethers: HardhatEthersHelpers,
  contractAddress: string
) {
  return ethers.getContractAt(IERC20_SOURCE, contractAddress);
}
export async function getIbEURPoolContract(ethers: HardhatEthersHelpers) {
  return ethers.getContractAt(
    IERC20_SOURCE,
    "0x67e019bfbd5a67207755D04467D6A70c0B75bF60"
  );
}
