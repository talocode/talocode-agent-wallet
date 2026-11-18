"""Stdio MCP server. It can request a payment. It cannot sign."""

from __future__ import annotations

import json
import sys

from .client import TalocodeAgentWallet, TalocodeError

TOOLS = [
    {"name": "api_health", "description": "Public health. No key. No Devnet call.", "inputSchema": {"type": "object", "properties": {}}},
    {"name": "api_capabilities", "description": "Public API catalog. This server cannot sign.", "inputSchema": {"type": "object", "properties": {}}},
    {"name": "list_agents", "description": "List agents.", "inputSchema": {"type": "object", "properties": {}}},
    {"name": "list_wallets", "description": "List wallet public metadata. Private keys are not returned.", "inputSchema": {"type": "object", "properties": {}}},
    {"name": "get_wallet_balance", "description": "Read a live Devnet SOL and USDC balance.", "inputSchema": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]}},
    {"name": "request_payment", "description": "Ask for a Devnet payment. Does not sign or submit.", "inputSchema": {"type": "object", "properties": {"agentId": {"type": "string"}, "walletId": {"type": "string"}, "recipient": {"type": "string"}, "amount": {"type": "string"}, "token": {"type": "string"}, "idempotencyKey": {"type": "string"}}, "required": ["agentId", "walletId", "recipient", "amount"]}},
    {"name": "list_transactions", "description": "List recent transactions.", "inputSchema": {"type": "object", "properties": {"status": {"type": "string"}, "agentId": {"type": "string"}}}},
]


def client_from(env, opener=None) -> TalocodeAgentWallet:
    return TalocodeAgentWallet(env.get("TALOCODE_BASE_URL") or "", env.get("TALOCODE_API_KEY") or "", opener=opener)


def call_tool(name, args, env, opener=None):
    if name in {"sign_transaction", "export_key", "submit_signed"}:
        raise TalocodeError("This server cannot sign, export a key, or submit a signature.", 403)
    client = client_from(env, opener)
    args = args or {}
    if name == "api_health":
        return client.health()
    if name == "api_capabilities":
        return client.capabilities()
    if name == "list_agents":
        return client.list_agents()
    if name == "list_wallets":
        return client.list_wallets()
    if name == "get_wallet_balance":
        return client.get_balance(args["id"])
    if name == "request_payment":
        return client.request_payment(
            args["agentId"],
            args["walletId"],
            args["recipient"],
            str(args["amount"]),
            args.get("token") or "SOL",
            args.get("idempotencyKey") or "",
        )
    if name == "list_transactions":
        return client.list_transactions(args.get("status") or "", args.get("agentId") or "")
    raise TalocodeError("Unknown tool.", 404)


def handle_message(message, env, opener=None):
    if not message or message.get("jsonrpc") != "2.0":
        return None
    method = message.get("method")
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": message.get("id"),
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "talocode-agent-wallet", "version": "0.2.0"},
            },
        }
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": message.get("id"), "result": {"tools": TOOLS}}
    if method == "tools/call":
        try:
            result = call_tool(message.get("params", {}).get("name"), message.get("params", {}).get("arguments") or {}, env, opener)
            return {"jsonrpc": "2.0", "id": message.get("id"), "result": {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}}
        except Exception as error:  # noqa: BLE001 — MCP clients need the tool error, not a crash
            return {"jsonrpc": "2.0", "id": message.get("id"), "result": {"isError": True, "content": [{"type": "text", "text": str(error)}]}}
    if "id" in message:
        return {"jsonrpc": "2.0", "id": message.get("id"), "error": {"code": -32601, "message": "Method not found."}}
    return None


def start_mcp(env=None) -> None:
    env = env if env is not None else __import__("os").environ
    stdin = sys.stdin.buffer
    buffer = b""
    while True:
        chunk = stdin.read(1)
        if not chunk:
            return
        buffer += chunk
        while True:
            header_end = buffer.find(b"\r\n\r\n")
            if header_end == -1:
                break
            header = buffer[:header_end].decode("utf-8", "replace")
            length = None
            for line in header.split("\r\n"):
                if line.lower().startswith("content-length:"):
                    length = int(line.split(":", 1)[1].strip())
            if length is None:
                buffer = buffer[header_end + 4 :]
                continue
            start = header_end + 4
            if len(buffer) < start + length:
                more = stdin.read(start + length - len(buffer))
                if not more:
                    return
                buffer += more
                continue
            body = buffer[start : start + length]
            buffer = buffer[start + length :]
            try:
                message = json.loads(body.decode("utf-8"))
            except json.JSONDecodeError:
                _send({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error."}})
                continue
            response = handle_message(message, env)
            if response is not None:
                _send(response)


def _send(message) -> None:
    raw = json.dumps(message).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(raw)}\r\n\r\n".encode("ascii") + raw)
    sys.stdout.buffer.flush()
