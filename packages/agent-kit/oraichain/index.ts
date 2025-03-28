import {
  CosmWasmClient,
  createWasmAminoConverters,
  setupWasmExtension,
  SigningCosmWasmClient,
  WasmExtension,
  wasmTypes,
} from "@cosmjs/cosmwasm-stargate";
import {
  DirectSecp256k1HdWallet,
  EncodeObject,
  encodePubkey,
  makeAuthInfoBytes,
  makeSignBytes,
  makeSignDoc,
  Registry,
} from "@cosmjs/proto-signing";
import {
  AminoTypes,
  BankExtension,
  calculateFee,
  Coin,
  createDefaultAminoConverters,
  defaultRegistryTypes,
  DistributionExtension,
  GasPrice,
  MintExtension,
  QueryClient,
  setupBankExtension,
  setupDistributionExtension,
  setupMintExtension,
  setupStakingExtension,
  setupTxExtension,
  StakingExtension,
  TxExtension,
} from "@cosmjs/stargate";
import { Binary, ORAI } from "@oraichain/common";
import { Comet38Client } from "@cosmjs/tendermint-rpc";
import { SignDoc, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";
import {
  Secp256k1HdWallet,
  Secp256k1Pubkey,
  StdFee,
  StdSignDoc,
  StdSignature,
  encodeSecp256k1Pubkey,
} from "@cosmjs/amino";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing.js";
import { Any } from "cosmjs-types/google/protobuf/any.js";
import { Int53 } from "@cosmjs/math";
import { PubKey } from "cosmjs-types/cosmos/crypto/secp256k1/keys.js";
import { fromBase64, toBase64 } from "@cosmjs/encoding";
import { assertDefined } from "@cosmjs/utils";

type PubkeyType =
  | "/ethermint.crypto.v1.ethsecp256k1.PubKey" // for ethermint txs
  | "/cosmos.crypto.secp256k1.PubKey"; // for cosmos txs

/**
 * Main class for interacting with Oraichain blockchain
 * Provides a unified interface for token operations, NFT management, trading and more
 *
 * @class OraichainAgentKit
 * @property {DirectSecp256k1HdWallet} wallet - Wallet instance for signing transactions
 * @property {SigningCosmWasmClient} client - Client instance for interacting with the blockchain
 */
export class OraichainAgentKit {
  public gasMultiplier: number = 1.5;
  private constructor(
    public readonly rpcUrl: string,
    public readonly client: CosmWasmClient,
    public readonly queryClient: QueryClient &
      BankExtension &
      StakingExtension &
      WasmExtension &
      MintExtension &
      DistributionExtension &
      TxExtension,
    public readonly registry = new Registry([
      ...defaultRegistryTypes,
      ...wasmTypes,
    ]),
    public readonly aminoTypes = new AminoTypes({
      ...createDefaultAminoConverters(),
      ...createWasmAminoConverters(),
    })
  ) {}

  static async connect(rpcUrl: string) {
    const client = await SigningCosmWasmClient.connect(rpcUrl);
    const comet = await Comet38Client.connect(rpcUrl);
    const queryClient = QueryClient.withExtensions(
      comet,
      setupBankExtension,
      setupStakingExtension,
      setupWasmExtension,
      setupMintExtension,
      setupTxExtension,
      setupDistributionExtension
    );
    return new OraichainAgentKit(rpcUrl, client, queryClient);
  }

  async getBalance(address: string, denom: string) {
    return this.client.getBalance(address, denom);
  }

  async getDelegation(address: string, validatorAddress: string) {
    return this.queryClient.staking.delegation(address, validatorAddress);
  }

  async transfer(
    senderAddress: string,
    publickey: string,
    toAddress: string,
    amount: Coin
  ) {
    const signDoc = await this.buildSignDoc(
      senderAddress,
      publickey,
      [
        {
          typeUrl: "/cosmos.bank.v1beta1.MsgSend",
          value: {
            fromAddress: senderAddress,
            toAddress,
            amount: [amount],
          },
        },
      ],
      "auto",
      ""
    );
    return {
      signDoc: Buffer.from(makeSignBytes(signDoc)).toString("base64"),
    };
  }

  /**
   * Build a sign doc for a transaction
   * @param senderAddress - Address of the sender
   * @param publicKey - Public key of the sender
   * @param messages - Messages to include in the transaction
   * @param memo - Memo for the transaction
   * @param fee - Fee for the transaction
   * @param timeoutHeight - Timeout height for the transaction
   */
  async buildSignDoc(
    senderAddress: string,
    publicKey: string,
    messages: readonly EncodeObject[],
    stdFee: StdFee | "auto",
    memo: string = "",
    timeoutHeight?: bigint
  ) {
    const { accountNumber, sequence } =
      await this.client.getSequence(senderAddress);
    const chainId = await this.client.getChainId();
    const pubkeyBuffer = Buffer.from(publicKey, "base64");
    const secp256k1Pubkey = encodeSecp256k1Pubkey(pubkeyBuffer);
    const pubkey = encodePubkey(secp256k1Pubkey);

    // simulate the tx
    let fee: StdFee;
    if (stdFee === "auto") {
      const gasUsed = await this.simulate(
        senderAddress,
        secp256k1Pubkey,
        messages,
        memo
      );
      const gasUsedWithMultiplier = (gasUsed * this.gasMultiplier).toFixed(0);
      fee = calculateFee(
        parseInt(gasUsedWithMultiplier),
        GasPrice.fromString(`0.001${ORAI}`)
      );
    } else {
      fee = stdFee;
    }

    // Create a proper TxBody object
    const txBodyObj = {
      typeUrl: "/cosmos.tx.v1beta1.TxBody",
      value: {
        messages: messages,
        memo: memo,
        timeoutHeight: timeoutHeight,
      },
    };

    // Use fromPartial to create a valid TxBody and then encode it
    const txBodyBytes = this.registry.encode(txBodyObj);

    // Handle fee based on its type
    const gasLimit = Int53.fromString(fee.gas).toNumber();
    const authInfoBytes = makeAuthInfoBytes(
      [{ pubkey, sequence }],
      fee.amount,
      gasLimit,
      fee.granter,
      fee.payer
    );
    return makeSignDoc(txBodyBytes, authInfoBytes, chainId, accountNumber);
  }

  buildTxRawBuffer(signDoc: SignDoc, signature: Binary) {
    const signatureBuffer = fromBase64(signature);
    const txRaw = TxRaw.fromPartial({
      bodyBytes: signDoc.bodyBytes,
      authInfoBytes: signDoc.authInfoBytes,
      signatures: [signatureBuffer],
    });
    return TxRaw.encode(txRaw).finish();
  }

  async broadcastSignDocBase64(signDocBase64: Binary, signature: Binary) {
    const signDocObj = SignDoc.decode(Buffer.from(signDocBase64, "base64"));
    const txBytes = this.buildTxRawBuffer(signDocObj, signature);
    return this.client.broadcastTxSync(txBytes);
  }
  /**
   * Submit a transaction to the blockchain
   * @param signedTx - Transaction to submit, in base64 format
   * @returns
   */
  async broadcastTxSync(signedTx: Binary) {
    return this.client.broadcastTxSync(fromBase64(signedTx));
  }

  /**
   * Broadcast a transaction to the blockchain
   * @param signedBodyBytes - Transaction body, in base64 format
   * @param signedAuthBytes - Transaction auth info, in base64 format
   * @param signature - Signature for the transaction, in base64 format
   */
  async broadcastTxSyncFromDirectSignDocAndSignature(
    signedBodyBytes: Binary,
    signedAuthBytes: Binary,
    signatures: Binary[]
  ) {
    const txRaw = TxRaw.fromPartial({
      bodyBytes: fromBase64(signedBodyBytes),
      authInfoBytes: fromBase64(signedAuthBytes),
      signatures: signatures.map((sig) => fromBase64(sig)),
    });
    const txBytes = TxRaw.encode(txRaw).finish();
    return this.client.broadcastTxSync(txBytes);
  }

  /**
   * Broadcast a transaction to the blockchain
   * @param signDoc - Transaction sign doc, in base64 format
   * @param signature - Signature for the transaction, in base64 format
   */
  async broadcastTxSyncFromStdSignDocAndSignature(
    signedDoc: StdSignDoc,
    signature: StdSignature,
    pubkeyType: PubkeyType = "/cosmos.crypto.secp256k1.PubKey"
  ) {
    const signedTxBody = {
      messages: signedDoc.msgs.map((msg) => this.aminoTypes.fromAmino(msg)),
      memo: signedDoc.memo,
    };
    const signedTxBodyEncodeObject = {
      typeUrl: "/cosmos.tx.v1beta1.TxBody",
      value: signedTxBody,
    };
    const signedTxBodyBytes = this.registry.encode(signedTxBodyEncodeObject);
    const signedGasLimit = Int53.fromString(signedDoc.fee.gas).toNumber();
    const signedSequence = Int53.fromString(signedDoc.sequence).toNumber();
    const pubkey = Any.fromPartial({
      typeUrl: pubkeyType,
      value: PubKey.encode({
        key: fromBase64(signature.pub_key.value),
      }).finish(),
    });
    const signedAuthInfoBytes = makeAuthInfoBytes(
      [{ pubkey: pubkey, sequence: signedSequence }],
      signedDoc.fee.amount,
      signedGasLimit,
      signedDoc.fee.granter,
      signedDoc.fee.payer,
      SignMode.SIGN_MODE_LEGACY_AMINO_JSON
    );
    const txRaw = TxRaw.fromPartial({
      bodyBytes: signedTxBodyBytes,
      authInfoBytes: signedAuthInfoBytes,
      signatures: [fromBase64(signature.signature)],
    });
    const txBytes = TxRaw.encode(txRaw).finish();
    return this.client.broadcastTxSync(txBytes);
  }

  async simulate(
    senderAddress: string,
    senderPubkey: Secp256k1Pubkey,
    messages: readonly EncodeObject[],
    memo: string
  ) {
    const anyMsgs = messages.map((m) => this.registry.encodeAsAny(m));
    const { sequence } = await this.client.getSequence(senderAddress);
    const { gasInfo } = await this.queryClient.tx.simulate(
      anyMsgs,
      memo,
      senderPubkey,
      sequence
    );
    assertDefined(gasInfo);
    return Int53.fromString(gasInfo.gasUsed.toString()).toNumber();
  }
}

export class OraichainAgentKitWithSigner {
  private constructor(
    public readonly agentKit: OraichainAgentKit,
    public readonly signer: DirectSecp256k1HdWallet,
    public readonly signerAmino: Secp256k1HdWallet,
    public readonly signingCosmWasmClient: SigningCosmWasmClient
  ) {}

  static async connectWithAgentKit(
    agentKit: OraichainAgentKit,
    mnemonic: string
  ) {
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: ORAI,
    });
    const signerAmino = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: ORAI,
    });
    const signingCosmWasmClient = await SigningCosmWasmClient.connectWithSigner(
      agentKit.rpcUrl,
      signer,
      {
        gasPrice: GasPrice.fromString("0.001" + ORAI),
        registry: agentKit.registry,
        aminoTypes: agentKit.aminoTypes,
      }
    );
    return new OraichainAgentKitWithSigner(
      agentKit,
      signer,
      signerAmino,
      signingCosmWasmClient
    );
  }

  static async connectWithSigner(rpcUrl: string, mnemonic: string) {
    const agentKit = await OraichainAgentKit.connect(rpcUrl);
    return this.connectWithAgentKit(agentKit, mnemonic);
  }

  async getSignerInfo(accountIndex: number = 0) {
    const accounts = await this.signer.getAccounts();
    const account = accounts[accountIndex];
    const { sequence, accountNumber } =
      await this.signingCosmWasmClient.getSequence(account.address);

    return {
      address: account.address,
      pubkey: toBase64(account.pubkey),
      sequence,
      accountNumber,
    };
  }

  async sign(
    signDocBase64: Binary,
    accountIndex: number = 0,
    direct: boolean = true
  ) {
    if (direct) {
      return this.signDirect(signDocBase64, accountIndex);
    }
    return this.signAmino(signDocBase64, accountIndex);
  }

  async signDirect(signDocBase64: Binary, accountIndex: number = 0) {
    const signDoc = SignDoc.decode(Buffer.from(signDocBase64, "base64"));
    const accounts = await this.signer.getAccounts();
    const wallet = accounts[accountIndex];
    const response = await this.signer.signDirect(wallet.address, signDoc);
    return {
      signDoc: toBase64(makeSignBytes(signDoc)),
      signature: response.signature.signature,
    };
  }

  async signAmino(signDocBase64: Binary, accountIndex: number = 0) {
    const signDoc: StdSignDoc = JSON.parse(
      Buffer.from(signDocBase64, "base64").toString("utf-8")
    );
    const accounts = await this.signerAmino.getAccounts();
    const wallet = accounts[accountIndex];
    const response = await this.signerAmino.signAmino(wallet.address, signDoc);
    return {
      signDoc: signDocBase64,
      signature: Buffer.from(JSON.stringify(response.signature)).toString(
        "base64"
      ),
    };
  }
}
