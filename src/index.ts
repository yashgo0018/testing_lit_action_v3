import { ethers } from "ethers";
import dotenv from "dotenv";
import { LitContracts } from "@lit-protocol/contracts-sdk";

import * as LitJsSdk from "@lit-protocol/lit-node-client-nodejs";

import { AuthMethodScope, AuthMethodType } from "@lit-protocol/constants";
import { SiweMessage } from "siwe";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY || "";
const rpcUrl = process.env.RPC_URL || "";
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

const wallet = new ethers.Wallet(privateKey, provider);

async function getAuthSig(nonce: string) {
  const address = await wallet.getAddress();

  // Craft the SIWE message
  const domain = "localhost";
  const origin = "https://localhost/login";
  const statement =
    "This is a test statement.  You can put anything you want here.";
  const siweMessage = new SiweMessage({
    domain,
    address: address,
    statement,
    uri: origin,
    version: "1",
    chainId: (await provider.getNetwork()).chainId,
    nonce,
  });
  const messageToSign = siweMessage.prepareMessage();

  // Sign the message and format the authSig
  const signature = await wallet.signMessage(messageToSign);

  const authSig = {
    sig: signature,
    derivedVia: "web3.eth.personal.sign",
    signedMessage: messageToSign,
    address: address,
  };

  return authSig;
}

async function main() {
  const contractClient = new LitContracts({
    signer: wallet,
  });

  await contractClient.connect();

  console.log(await contractClient.pkpNftContract.read.address);

  const litNodeClient = new LitJsSdk.LitNodeClientNodeJs({
    alertWhenUnauthorized: false,
    litNetwork: "cayenne",
  });
  await litNodeClient.connect();

  const nonce = litNodeClient.getLatestBlockhash();

  const authSig = await getAuthSig(nonce as string);
  console.log(authSig);

  const mintCost = await contractClient.pkpNftContract.read.mintCost();
  console.log(mintCost);

  const authMethod = {
    authMethodType: AuthMethodType.EthWallet,
    accessToken: JSON.stringify(authSig),
  };

  const mintInfo = await contractClient.mintWithAuth({
    authMethod,
    scopes: [
      AuthMethodScope.NoPermissions,
      AuthMethodScope.SignAnything,
      AuthMethodScope.OnlySignMessages,
    ],
  });

  console.log(mintInfo);
}

main();
