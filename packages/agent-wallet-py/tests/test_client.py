import io
import json
import unittest
from urllib.error import HTTPError

from talocode_agent_wallet.cli import run
from talocode_agent_wallet.client import TalocodeAgentWallet, TalocodeError, join_url
from talocode_agent_wallet.mcp import handle_message


class FakeResponse:
    def __init__(self, payload, status=200):
        self.payload = payload
        self.status = status

    def read(self):
        return json.dumps(self.payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class ClientTests(unittest.TestCase):
    def test_join_url_keeps_a_base_path(self):
        self.assertEqual(join_url("https://agent.example/agent-wallet", "/api/v1/health"), "https://agent.example/agent-wallet/api/v1/health")

    def test_health_does_not_send_a_key(self):
        seen = {}

        def opener(req, timeout=30):
            seen["auth"] = req.get_header("Authorization")
            seen["url"] = req.full_url
            return FakeResponse({"ok": True, "signing": "owner-device-only"})

        client = TalocodeAgentWallet("https://agent.example", opener=opener)
        body = client.health()
        self.assertTrue(body["ok"])
        self.assertIsNone(seen["auth"])
        self.assertEqual(seen["url"], "https://agent.example/api/v1/health")

    def test_api_error_status(self):
        def opener(req, timeout=30):
            raise HTTPError(req.full_url, 401, "no", hdrs=None, fp=io.BytesIO(b'{"error":{"message":"API key is not valid."}}'))

        client = TalocodeAgentWallet("https://agent.example", "tk_example", opener=opener)
        with self.assertRaises(TalocodeError) as caught:
            client.list_agents()
        self.assertEqual(caught.exception.status, 401)

    def test_cli_payment_refuses_to_imply_a_signature(self):
        err = io.StringIO()
        code = run(["payments", "request", "--amount", "0.01"], {"TALOCODE_BASE_URL": "https://agent.example", "TALOCODE_API_KEY": "tk_example"}, stderr=err)
        self.assertEqual(code, 2)
        self.assertIn("does not sign", err.getvalue())

    def test_mcp_refuses_to_sign(self):
        listed = handle_message({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, {})
        names = [tool["name"] for tool in listed["result"]["tools"]]
        self.assertIn("request_payment", names)
        self.assertNotIn("sign_transaction", names)
        signed = handle_message({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "sign_transaction", "arguments": {}}}, {})
        self.assertTrue(signed["result"]["isError"])
        self.assertIn("cannot sign", signed["result"]["content"][0]["text"])


if __name__ == "__main__":
    unittest.main()
