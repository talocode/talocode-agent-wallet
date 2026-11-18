"""HTTP client for the Agent Wallet API. No third-party dependencies."""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen

PACKAGE_NAME = "talocode-agent-wallet"
PACKAGE_VERSION = "0.2.0"


class TalocodeError(Exception):
    def __init__(self, message: str, status: int):
        super().__init__(message)
        self.status = status


def join_url(base_url: str, path: str) -> str:
    root = base_url if base_url.endswith("/") else f"{base_url}/"
    relative = path[1:] if path.startswith("/") else path
    return urljoin(root, relative)


class TalocodeAgentWallet:
    def __init__(self, base_url: str, api_key: str = "", opener=None):
        self.base_url = (base_url or "").strip()
        self.api_key = api_key or ""
        self.opener = opener or urlopen
        if not self.base_url:
            raise TalocodeError("baseUrl is required.", 0)

    def request(self, method: str, path: str, body=None, headers=None, auth: bool = True):
        if auth and not self.api_key.strip():
            raise TalocodeError("apiKey is required.", 0)
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = Request(join_url(self.base_url, path), data=data, method=method)
        req.add_header("accept", "application/json")
        if auth:
            req.add_header("authorization", f"Bearer {self.api_key}")
        if body is not None:
            req.add_header("content-type", "application/json")
        for key, value in (headers or {}).items():
            req.add_header(key, value)
        try:
            with self.opener(req, timeout=30) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except HTTPError as error:
            raw = error.read().decode("utf-8")
            message = f"Request failed ({error.code})."
            try:
                payload = json.loads(raw)
                message = (payload.get("error") or {}).get("message") or message
            except json.JSONDecodeError:
                pass
            raise TalocodeError(message, error.code) from None
        except URLError as error:
            raise TalocodeError(str(error.reason), 0) from None

    def health(self):
        return self.request("GET", "/api/v1/health", auth=False)

    def capabilities(self):
        return self.request("GET", "/api/v1/capabilities", auth=False)

    def list_agents(self):
        return self.request("GET", "/api/v1/agents")

    def get_agent(self, agent_id: str):
        return self.request("GET", f"/api/v1/agents/{agent_id}")

    def create_agent(self, name: str, description: str = ""):
        return self.request("POST", "/api/v1/agents", {"name": name, "description": description})

    def list_wallets(self):
        return self.request("GET", "/api/v1/wallets")

    def get_balance(self, wallet_id: str):
        return self.request("GET", f"/api/v1/wallets/{wallet_id}/balance")

    def list_transactions(self, status: str = "", agent_id: str = ""):
        query = {}
        if status:
            query["status"] = status
        if agent_id:
            query["agentId"] = agent_id
        suffix = f"?{urlencode(query)}" if query else ""
        return self.request("GET", f"/api/v1/transactions{suffix}")

    def get_transaction(self, transaction_id: str):
        return self.request("GET", f"/api/v1/transactions/{transaction_id}")

    def request_payment(
        self,
        agent_id: str,
        wallet_id: str,
        recipient: str,
        amount: str,
        token: str = "SOL",
        idempotency_key: str = "",
    ):
        body = {
            "agentId": agent_id,
            "walletId": wallet_id,
            "recipient": recipient,
            "amount": amount,
            "token": token,
        }
        headers = {"idempotency-key": idempotency_key} if idempotency_key else None
        if idempotency_key:
            body["idempotencyKey"] = idempotency_key
        return self.request("POST", "/api/v1/transactions", body, headers)

    def usage(self):
        return self.request("GET", "/api/v1/usage")

    def network(self):
        return self.request("GET", "/api/v1/network")
