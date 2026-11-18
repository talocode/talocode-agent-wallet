"""CLI for Talocode Agent Wallet. It can request a payment. It cannot sign."""

from __future__ import annotations

import json
import os
import sys

from .client import TalocodeAgentWallet, TalocodeError
from .mcp import start_mcp

HELP = """talocode-wallet — Talocode Agent Wallet CLI (Python)
Solana Devnet. This program cannot sign or export a key.

Usage:
  talocode-wallet health
  talocode-wallet capabilities
  talocode-wallet agents list
  talocode-wallet agents create --name <name> [--description <text>]
  talocode-wallet wallets list
  talocode-wallet wallets balance <id>
  talocode-wallet payments list [--status <status>] [--agent <id>]
  talocode-wallet payments get <id>
  talocode-wallet payments request --agent <id> --wallet <id> --recipient <address> --amount <sol> [--token SOL|USDC] [--idempotency-key <key>]
  talocode-wallet usage
  talocode-wallet network
  talocode-wallet mcp

Environment:
  TALOCODE_BASE_URL   API origin, including any base path
  TALOCODE_API_KEY    Bearer key. Not required for health, capabilities, or mcp startup.

A payment request does not sign and does not submit.
"""


def flags(args):
    parsed = {"_": []}
    i = 0
    while i < len(args):
        item = args[i]
        if item.startswith("--"):
            key = item[2:]
            nxt = args[i + 1] if i + 1 < len(args) else None
            if nxt is None or nxt.startswith("--"):
                parsed[key] = True
            else:
                parsed[key] = nxt
                i += 1
        else:
            parsed["_"].append(item)
        i += 1
    return parsed


def run(argv, env=None, opener=None, stdout=None, stderr=None) -> int:
    env = env if env is not None else os.environ
    out = stdout if stdout is not None else sys.stdout
    err = stderr if stderr is not None else sys.stderr
    if not argv or argv[0] in {"help", "--help", "-h"}:
        out.write(HELP)
        return 0
    if argv[0] == "mcp":
        start_mcp(env)
        return 0

    base = (env.get("TALOCODE_BASE_URL") or "").strip()
    key = env.get("TALOCODE_API_KEY") or ""
    if not base:
        err.write("Set TALOCODE_BASE_URL.\n")
        return 2
    try:
        client = TalocodeAgentWallet(base, key, opener=opener)
        cmd, *rest = argv
        opts = flags(rest)
        if cmd == "health":
            payload = client.health()
        elif cmd == "capabilities":
            payload = client.capabilities()
        elif cmd == "agents" and opts["_"][:1] == ["list"]:
            payload = client.list_agents()
        elif cmd == "agents" and opts["_"][:1] == ["create"]:
            if not opts.get("name"):
                err.write("agents create needs --name.\n")
                return 2
            payload = client.create_agent(str(opts["name"]), str(opts.get("description") or ""))
        elif cmd == "wallets" and opts["_"][:1] == ["list"]:
            payload = client.list_wallets()
        elif cmd == "wallets" and opts["_"][:1] == ["balance"] and len(opts["_"]) > 1:
            payload = client.get_balance(opts["_"][1])
        elif cmd == "payments" and opts["_"][:1] == ["list"]:
            payload = client.list_transactions(str(opts.get("status") or ""), str(opts.get("agent") or ""))
        elif cmd == "payments" and opts["_"][:1] == ["get"] and len(opts["_"]) > 1:
            payload = client.get_transaction(opts["_"][1])
        elif cmd == "payments" and opts["_"][:1] == ["request"]:
            missing = [name for name in ("agent", "wallet", "recipient", "amount") if not opts.get(name)]
            if missing:
                err.write("payments request needs --agent, --wallet, --recipient, and --amount. This command does not sign.\n")
                return 2
            payload = client.request_payment(
                str(opts["agent"]),
                str(opts["wallet"]),
                str(opts["recipient"]),
                str(opts["amount"]),
                str(opts.get("token") or "SOL"),
                str(opts.get("idempotency-key") or ""),
            )
            payload = {"signed": False, "note": "Awaiting the owner signature. This CLI did not sign.", **payload}
        elif cmd == "usage":
            payload = client.usage()
        elif cmd == "network":
            payload = client.network()
        else:
            err.write(HELP)
            return 2
    except TalocodeError as error:
        err.write(f"{error}\n")
        return 1
    out.write(json.dumps(payload, indent=2) + "\n")
    return 0


def main(argv=None) -> None:
    code = run(sys.argv[1:] if argv is None else argv)
    if code:
        raise SystemExit(code)
