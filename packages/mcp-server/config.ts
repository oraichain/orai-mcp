import "dotenv/config";

export const serverPort = process.env.PORT || 4000;
export const oraichainRpcUrl = process.env.RPC_URL || "https://rpc.orai.io";