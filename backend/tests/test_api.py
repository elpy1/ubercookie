"""Server-side vector + observation-log tests.

The TestClient is not a browser and has no HTTP cache, so we simulate the
browser's conditional requests by sending If-None-Match ourselves. That isolates
and verifies the *server* logic; real cache behaviour is exercised in a browser.
"""

from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)

HEX = "0123456789abcdef0123456789abcdef"
HEX2 = "ffffffffffffffffffffffffffffffff"


def test_first_visit_mints_id_and_sets_cookie():
    client.cookies.clear()
    r = client.post("/api/visit", json={"id": None, "recovered_from": []})
    assert r.status_code == 200
    body = r.json()
    assert body["minted_now"] is True
    assert body["visit_count"] == 1
    assert len(body["id"]) == 32
    assert config.COOKIE_NAME in r.cookies  # HttpOnly cookie was set


def test_repeat_visit_increments_count():
    client.cookies.clear()
    r1 = client.post("/api/visit", json={"id": HEX, "recovered_from": ["localStorage"]})
    assert r1.json()["visit_count"] == 1
    r2 = client.post("/api/visit", json={"id": HEX, "recovered_from": ["localStorage"]})
    assert r2.json()["visit_count"] == 2
    assert r2.json()["minted_now"] is False


def test_invalid_id_is_rejected_and_minted_fresh():
    client.cookies.clear()
    r = client.post("/api/visit", json={"id": "not-a-valid-id", "recovered_from": []})
    assert r.json()["minted_now"] is True
    assert r.json()["id"] != "not-a-valid-id"


def test_etag_supercookie_round_trip():
    # Write: stamp an id into the ETag via the set-header.
    w = client.get("/api/etag-id", headers={config.SET_HEADER: HEX})
    assert w.headers["etag"] == f'"{HEX}"'
    assert w.headers["cache-control"] == "private, no-cache"
    assert w.headers["cloudflare-cdn-cache-control"] == "no-store"
    assert w.json()["stamped"] == HEX

    # Read: the browser would echo the stored ETag — we simulate that header.
    r = client.get("/api/etag-id", headers={"If-None-Match": f'"{HEX}"'})
    assert r.json()["recovered"] == HEX


def test_etag_ignores_garbage_validator():
    r = client.get("/api/etag-id", headers={"If-None-Match": '"garbage"'})
    assert r.json()["recovered"] is None


def test_cache_id_js_embeds_id_when_set():
    r = client.get("/api/cache-id.js", headers={config.SET_HEADER: HEX2})
    assert r.headers["cache-control"].startswith("private")
    assert "immutable" in r.headers["cache-control"]
    assert r.headers["cloudflare-cdn-cache-control"] == "no-store"
    assert f'"{HEX2}"' in r.text


def test_cache_id_js_is_uncacheable_without_id():
    r = client.get("/api/cache-id.js")
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["cloudflare-cdn-cache-control"] == "no-store"
    assert "null" in r.text


def test_whoami_reads_httponly_cookie():
    client.cookies.clear()
    client.post("/api/visit", json={"id": HEX, "recovered_from": []})
    r = client.get("/api/whoami")
    assert r.json()["cookie"] == HEX
    assert r.json()["record"]["id"] == HEX
    assert "user_agent" not in r.json()["record"]


def test_forget_wipes_record_and_cookie():
    client.cookies.clear()
    client.post("/api/visit", json={"id": HEX2, "recovered_from": []})
    assert client.get("/api/whoami").json()["cookie"] == HEX2

    f = client.request("DELETE", "/api/forget")
    assert HEX2 in f.json()["forgotten"]

    client.cookies.clear()  # the browser would drop the expired cookie
    assert client.get("/api/whoami").json()["cookie"] is None


def test_last_modified_round_trip():
    client.cookies.clear()
    # The server must have recorded this id (the token→id reverse lookup).
    client.post("/api/visit", json={"id": HEX, "recovered_from": []})

    # Write: stamp a Last-Modified date encoding HEX.
    w = client.get("/api/lastmod-id", headers={config.SET_HEADER: HEX})
    assert "last-modified" in w.headers
    assert w.headers["cache-control"] == "private, no-cache"
    assert w.headers["cloudflare-cdn-cache-control"] == "no-store"
    assert w.json()["stamped"] == HEX

    # Read: the browser would echo the date via If-Modified-Since.
    r = client.get("/api/lastmod-id", headers={"If-Modified-Since": w.headers["last-modified"]})
    assert r.json()["recovered"] == HEX


def test_last_modified_unknown_date_recovers_nothing():
    r = client.get("/api/lastmod-id", headers={"If-Modified-Since": "Wed, 21 Oct 2015 07:28:00 GMT"})
    assert r.json()["recovered"] is None
