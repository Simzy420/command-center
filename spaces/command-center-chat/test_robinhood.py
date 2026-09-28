import os
import unittest
import uuid

from fastapi.testclient import TestClient

from main import RATE, app, snapshot_file


SAMPLE = {
    "updatedAt": "2026-09-28T15:04:00Z",
    "account": {"label": "", "last4": "999988886740", "accountNumber": "1234999988886740"},
    "totalValue": 118532.25,
    "equityValue": 175464.27,
    "cryptoValue": 26130.89,
    "cash": -83062.91,
    "currency": "USD",
    "positions": [
        {
            "symbol": "pltr",
            "quantity": 149.998,
            "avgCost": 142.02,
            "price": 0,
            "marketValue": 0,
            "dayChangePct": None,
        }
    ],
}


class RobinhoodBridgeTest(unittest.TestCase):
    def setUp(self) -> None:
        self._env = {
            "ROBINHOOD_BRIDGE_SECRET": os.environ.get("ROBINHOOD_BRIDGE_SECRET"),
            "CHAT_BRIDGE_SECRET": os.environ.get("CHAT_BRIDGE_SECRET"),
        }
        os.environ.pop("ROBINHOOD_BRIDGE_SECRET", None)
        os.environ["CHAT_BRIDGE_SECRET"] = "chat-secret-value"
        RATE.clear()
        path = snapshot_file()
        if path.exists():
            path.unlink()
        tmp = path.with_suffix(path.suffix + ".tmp")
        if tmp.exists():
            tmp.unlink()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        path = snapshot_file()
        if path.exists():
            path.unlink()
        for key, value in self._env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def test_get_empty_snapshot_is_public(self) -> None:
        res = self.client.get("/api/robinhood")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"snapshot": None})
        self.assertEqual(res.headers.get("cache-control"), "no-store")

    def test_post_requires_bearer_and_masks_account(self) -> None:
        denied = self.client.post("/api/robinhood", json=SAMPLE)
        self.assertEqual(denied.status_code, 401)
        wrong = self.client.post(
            "/api/robinhood",
            json=SAMPLE,
            headers={"Authorization": "Bearer nope"},
        )
        self.assertEqual(wrong.status_code, 401)

        ok = self.client.post(
            "/api/robinhood",
            json=SAMPLE,
            headers={"Authorization": "Bearer chat-secret-value"},
        )
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["updatedAt"], "2026-09-28T15:04:00Z")

        got = self.client.get("/api/robinhood")
        snapshot = got.json()["snapshot"]
        self.assertEqual(snapshot["account"], {"label": "Individual", "last4": "6740"})
        self.assertNotIn("accountNumber", snapshot["account"])
        self.assertNotIn("1234999988886740", got.text)
        self.assertEqual(snapshot["totalValue"], 118532.25)
        self.assertEqual(snapshot["positions"][0]["symbol"], "PLTR")
        self.assertEqual(snapshot["positions"][0]["price"], 0)

    def test_post_replaces_snapshot(self) -> None:
        headers = {"Authorization": "Bearer chat-secret-value"}
        self.client.post("/api/robinhood", json=SAMPLE, headers=headers)
        replaced = dict(SAMPLE)
        replaced["totalValue"] = 10
        replaced["positions"] = []
        res = self.client.post("/api/robinhood", json=replaced, headers=headers)
        self.assertEqual(res.status_code, 200)
        snapshot = self.client.get("/api/robinhood").json()["snapshot"]
        self.assertEqual(snapshot["totalValue"], 10)
        self.assertEqual(snapshot["positions"], [])

    def test_dedicated_secret_replaces_chat_secret(self) -> None:
        os.environ["ROBINHOOD_BRIDGE_SECRET"] = "rh-secret-value"
        chat = self.client.post(
            "/api/robinhood",
            json=SAMPLE,
            headers={"Authorization": "Bearer chat-secret-value"},
        )
        self.assertEqual(chat.status_code, 401)
        ok = self.client.post(
            "/api/robinhood",
            json=SAMPLE,
            headers={"Authorization": "Bearer rh-secret-value"},
        )
        self.assertEqual(ok.status_code, 200)

    def test_missing_secret_is_not_open(self) -> None:
        os.environ.pop("ROBINHOOD_BRIDGE_SECRET", None)
        os.environ.pop("CHAT_BRIDGE_SECRET", None)
        res = self.client.post("/api/robinhood", json=SAMPLE, headers={"Authorization": "Bearer anything"})
        self.assertEqual(res.status_code, 500)

    def test_chat_reply_still_uses_chat_secret(self) -> None:
        os.environ["ROBINHOOD_BRIDGE_SECRET"] = "rh-secret-value"
        body = {
            "sessionId": str(uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")),
            "clientMsgId": "cmt_test",
            "botId": "chief",
            "text": "ok",
            "status": "final",
        }
        denied = self.client.post(
            "/api/chat/reply",
            json=body,
            headers={"Authorization": "Bearer rh-secret-value"},
        )
        self.assertEqual(denied.status_code, 401)
        ok = self.client.post(
            "/api/chat/reply",
            json=body,
            headers={"Authorization": "Bearer chat-secret-value"},
        )
        self.assertEqual(ok.status_code, 200)
        polled = self.client.get(f"/api/chat?sessionId={body['sessionId']}")
        self.assertEqual(polled.status_code, 200)
        self.assertEqual(polled.json()["messages"][-1]["text"], "ok")


if __name__ == "__main__":
    unittest.main()
