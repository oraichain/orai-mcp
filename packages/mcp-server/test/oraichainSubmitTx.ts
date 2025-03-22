import {
  createWasmAminoConverters,
  SigningCosmWasmClient,
  wasmTypes,
} from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet, Registry } from "@cosmjs/proto-signing";
import {
  AminoTypes,
  Coin,
  createDefaultAminoConverters,
  defaultRegistryTypes,
  GasPrice,
} from "@cosmjs/stargate";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { ORAI } from "@oraichain/common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { toBase64, toHex } from "@cosmjs/encoding";
import { setTimeout } from "timers/promises";
import assert from "assert";
import { makeSignDoc, Secp256k1HdWallet } from "@cosmjs/amino";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { sha256 } from "@cosmjs/crypto";

(async () => {
  // setup SSE Server for testing
  const transport = new SSEClientTransport(
    new URL("http://localhost:8080/sse"),
  );
  const sseClient = new Client({ name: "test-client", version: "0.0.1" });
  await sseClient.connect(transport);

  await testSignAndBroadcastDirectTx(sseClient);
  await testSignAndBroadcastAminoTx(sseClient);
  await testSignAndBroadcastTxBytes(sseClient);
  // close transport & connection
  await sseClient.close();
})();

async function testSignAndBroadcastDirectTx(sseClient: Client) {
  // setup wallet to sign
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
    process.env.MNEMONIC!,
    { prefix: "orai" },
  );
  const accounts = await wallet.getAccounts();

  const client = await SigningCosmWasmClient.connectWithSigner(
    process.env.RPC_URL!,
    wallet,
    {
      gasPrice: GasPrice.fromString("0.0001orai"),
      registry: new Registry([...defaultRegistryTypes, ...wasmTypes]),
    },
  );

  const transferMessageResult = await sseClient.callTool({
    name: "TOKEN_TRANSFER_ACTION",
    arguments: {
      senderAddress: accounts[0].address,
      recipient: accounts[0].address,
      amount: { amount: "1", denom: ORAI } as Coin,
    },
  });

  const message = JSON.parse(
    (transferMessageResult.content as any)[0].text,
  ).data;

  const txRaw = await client.sign(
    accounts[0].address,
    [message],
    { amount: [{ amount: "0", denom: ORAI }], gas: "20000000" },
    "",
  );

  const txHashData = await sseClient.callTool({
    name: "BROADCAST_SIGNED_TX_FROM_SIGNED_BYTES_AND_SIGNATURE_ACTION",
    arguments: {
      signedBodyBytes: toBase64(txRaw.bodyBytes),
      signedAuthBytes: toBase64(txRaw.authInfoBytes),
      signatures: txRaw.signatures.map((sig) => toBase64(sig)),
    },
  });
  const txHash = JSON.parse((txHashData.content as any)[0].text).data.txHash;
  await setTimeout(2000);
  const txHashInfo = await client.getTx(txHash);
  assert(txHashInfo !== null);
  assert(txHashInfo.code === 0);
  assert(txHashInfo.hash === txHash);
}

async function testSignAndBroadcastAminoTx(sseClient: Client) {
  // sign amino tx
  const legacyWallet = await Secp256k1HdWallet.fromMnemonic(
    process.env.MNEMONIC!,
    { prefix: "orai" },
  );
  const accounts = await legacyWallet.getAccounts();
  const client = await SigningCosmWasmClient.connectWithSigner(
    process.env.RPC_URL!,
    legacyWallet,
    {
      gasPrice: GasPrice.fromString("0.0001orai"),
      registry: new Registry([...defaultRegistryTypes, ...wasmTypes]),
    },
  );
  const signer = accounts[0];

  // get transfer message
  const transferMessageResult = await sseClient.callTool({
    name: "TOKEN_TRANSFER_ACTION",
    arguments: {
      senderAddress: accounts[0].address,
      recipient: accounts[0].address,
      amount: { amount: "1", denom: ORAI } as Coin,
    },
  });

  const message = JSON.parse(
    (transferMessageResult.content as any)[0].text,
  ).data;

  // prep signing data for amino signing
  const { accountNumber, sequence } = await client.getSequence(signer.address);
  const chainId = await client.getChainId();
  const signerData = {
    accountNumber: accountNumber,
    sequence: sequence,
    chainId: chainId,
  };
  const aminoTypes = new AminoTypes({
    ...createDefaultAminoConverters(),
    ...createWasmAminoConverters(),
  });
  const aminoMsg = aminoTypes.toAmino(message);
  const signedDoc = await legacyWallet.signAmino(
    signer.address,
    makeSignDoc(
      [aminoMsg],
      { amount: [{ amount: "0", denom: ORAI }], gas: "20000000" },
      chainId,
      "",
      accountNumber,
      sequence,
    ),
  );

  // broadcast amino tx
  // get transfer message
  const txHashData = await sseClient.callTool({
    name: "BROADCAST_SIGNED_TX_FROM_STD_SIGNDOC_AND_SIGNATURE_ACTION",
    arguments: {
      signedDoc: signedDoc.signed,
      signature: signedDoc.signature,
    },
  });

  const txHash = JSON.parse((txHashData.content as any)[0].text).data.txHash;
  await setTimeout(2000);
  const txHashInfo = await client.getTx(txHash);
  assert(txHashInfo !== null);
  assert(txHashInfo.code === 0);
  assert(txHashInfo.hash === txHash);
}

async function testSignAndBroadcastTxBytes(sseClient: Client) {
  // setup wallet to sign
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
    process.env.MNEMONIC!,
    { prefix: "orai" },
  );
  const accounts = await wallet.getAccounts();

  const client = await SigningCosmWasmClient.connectWithSigner(
    process.env.RPC_URL!,
    wallet,
    {
      gasPrice: GasPrice.fromString("0.0001orai"),
      registry: new Registry([...defaultRegistryTypes, ...wasmTypes]),
    },
  );

  const transferMessageResult = await sseClient.callTool({
    name: "TOKEN_TRANSFER_ACTION",
    arguments: {
      senderAddress: accounts[0].address,
      recipient: accounts[0].address,
      amount: { amount: "1", denom: ORAI } as Coin,
    },
  });

  const message = JSON.parse(
    (transferMessageResult.content as any)[0].text,
  ).data;

  const txRaw = await client.sign(
    accounts[0].address,
    [message],
    { amount: [{ amount: "0", denom: ORAI }], gas: "20000000" },
    "",
  );
  const txBytes = TxRaw.encode(txRaw).finish();
  const txHashData = await sseClient.callTool({
    name: "BROADCAST_SIGNED_TX_ACTION",
    arguments: {
      signedTx: toBase64(txBytes),
    },
  });
  const txHash = JSON.parse((txHashData.content as any)[0].text).data.txHash;
  await setTimeout(2000);
  const txHashInfo = await client.getTx(txHash);
  assert(txHashInfo !== null);
  assert(txHashInfo.code === 0);
  assert(txHashInfo.hash === txHash);
  assert(txHashInfo.hash.toLowerCase() === toHex(sha256(txBytes)));
}
