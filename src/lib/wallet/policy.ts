export const NETWORK = "solana-devnet" as const;
export const USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const TOKENS = ["SOL", "USDC"] as const;
export type TokenSymbol = (typeof TOKENS)[number];

export type PolicyInput = {
  maxTxLamports: bigint;
  dailyLamports: bigint;
  monthlyLamports: bigint;
  approvedRecipients: string[];
  allowedTokens: string[];
  network: string;
  requireApproval: boolean;
  expiresAt: string | null;
  agentStatus: string;
};

export type SpendContext = {
  token: string;
  network: string;
  amountLamports: bigint;
  recipient: string;
  spentToday: bigint;
  spentMonth: bigint;
  now: Date;
};

export type PolicyDecision =
  | { ok: true; needsSignature: true; reason: string }
  | { ok: false; reason: string };

export function parseLamports(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Amount must be a positive number.");
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) throw new Error(`Use at most ${decimals} decimal places.`);
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const scale = 10n ** BigInt(decimals);
  const value = BigInt(whole) * scale + BigInt(padded || "0");
  if (value <= 0n) throw new Error("Amount must be greater than zero.");
  return value;
}

export function formatLamports(lamports: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const whole = lamports / scale;
  const frac = (lamports % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function decimalsFor(token: string): number {
  if (token === "SOL") return 9;
  if (token === "USDC") return 6;
  throw new Error("That token is not supported.");
}

/** Caps are stored as SOL lamports. 1 USDC counts as 1 SOL against those caps. */
export function comparableLamports(token: string, amount: bigint): bigint {
  if (token === "USDC") return amount * 1000n;
  if (token === "SOL") return amount;
  throw new Error("That token is not supported.");
}

export function money(amountLamports: string, token: string): string {
  const decimals = token === "USDC" ? 6 : 9;
  try {
    return `${formatLamports(BigInt(amountLamports), decimals)} ${token}`;
  } catch {
    return `${amountLamports} ${token}`;
  }
}

export function decidePolicy(policy: PolicyInput, spend: SpendContext): PolicyDecision {
  if (policy.agentStatus !== "active") {
    return { ok: false, reason: "This agent is not active." };
  }
  if (policy.expiresAt && new Date(policy.expiresAt).getTime() <= spend.now.getTime()) {
    return { ok: false, reason: "This spending policy has expired." };
  }
  if (spend.network !== NETWORK || policy.network !== NETWORK) {
    return { ok: false, reason: "Only Solana Devnet is supported. Mainnet, Base, and Ethereum are not connected." };
  }
  if (!policy.allowedTokens.includes(spend.token)) {
    return { ok: false, reason: `${spend.token} is not an approved token for this agent.` };
  }
  if (policy.approvedRecipients.length > 0 && !policy.approvedRecipients.includes(spend.recipient)) {
    return { ok: false, reason: "That recipient is not on the approved list." };
  }
  if (spend.amountLamports > policy.maxTxLamports) {
    return { ok: false, reason: "This payment is above the maximum transaction amount." };
  }
  if (spend.spentToday + spend.amountLamports > policy.dailyLamports) {
    return { ok: false, reason: "This payment would pass the daily limit." };
  }
  if (spend.spentMonth + spend.amountLamports > policy.monthlyLamports) {
    return { ok: false, reason: "This payment would pass the monthly limit." };
  }
  return {
    ok: true,
    needsSignature: true,
    reason: policy.requireApproval
      ? "Inside the policy. The owner still has to sign. This server cannot sign."
      : "Inside the policy. Signing still happens on your device. This server cannot sign.",
  };
}
