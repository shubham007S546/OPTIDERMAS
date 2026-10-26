"""Smoke test for the running inference API.

    python smoke_test.py [image_path] [--url http://127.0.0.1:8000]

Without an image path a synthetic dermoscopy-like image is generated.
Exits non-zero if /health or /predict violate the frontend contract.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
import uuid

import cv2
import numpy as np

URL = "http://127.0.0.1:8000"
args = [a for a in sys.argv[1:]]
if "--url" in args:
    i = args.index("--url")
    URL = args[i + 1]
    del args[i : i + 2]


def synthetic() -> bytes:
    rng = np.random.default_rng(0)
    img = np.full((450, 600, 3), (150, 170, 205), np.uint8)  # skin tone (BGR)
    img = np.clip(img.astype(np.int16) + rng.normal(0, 9, img.shape), 0, 255).astype(np.uint8)
    cv2.ellipse(img, (300, 225), (130, 100), 20, 0, 360, (40, 60, 110), -1)
    cv2.ellipse(img, (320, 235), (60, 45), 0, 0, 360, (25, 35, 70), -1)
    img = cv2.GaussianBlur(img, (3, 3), 0)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    assert ok
    return buf.tobytes()


def post_file(data: bytes, query: str = "") -> tuple[int, dict]:
    b = uuid.uuid4().hex
    body = (
        f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"t.jpg\"\r\n"
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + data + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request(
        f"{URL}/predict{query}", data=body, method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={b}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def main() -> int:
    with urllib.request.urlopen(f"{URL}/health", timeout=10) as r:
        health = json.loads(r.read())
    assert health == {"ok": True}, health
    print("[1/6] health ok")

    with urllib.request.urlopen(f"{URL}/ready", timeout=10) as r:
        ready = json.loads(r.read())
    assert ready.get("ready") is True, ready
    print(f"[2/6] ready ok (model: {ready.get('model_checkpoint')}, device: {ready.get('device')})")

    data = open(args[0], "rb").read() if args else synthetic()
    status, res = post_file(data, "?force=true")
    assert status == 200, (status, res)
    for key in (
        "probs",
        "top3",
        "malignant_flag",
        "malignant_prob",
        "risk",
        "metrics",
        "images",
        "analysis_id",
        "verification",
        "hair_removal",
    ):
        assert key in res, f"missing {key}"
    assert abs(sum(res["probs"].values()) - 1) < 1e-3, "probs do not sum to 1"
    assert len(res["top3"]) == 3
    assert {"original", "clean", "mask_overlay", "cam_overlay", "hair_mask"}.issubset(set(res["images"]))
    assert "passed" in res["verification"], "missing verification status"
    assert "diagnostics" in res["hair_removal"], "missing hair removal diagnostics"

    analysis_id = res["analysis_id"]
    print(f"[3/6] predict ok (analysis_id: {analysis_id})")
    print("      top3:", [(c, round(p, 3)) for c, p in res["top3"]])
    print("      verification:", res["verification"]["passed"], f"(warnings: {len(res['verification']['warnings'])})")
    print("      hair removed strands:", res["hair_removal"]["diagnostics"].get("hair_strands_detected"))

    # Test report JSON endpoint
    with urllib.request.urlopen(f"{URL}/analysis/{analysis_id}/report", timeout=10) as r:
        report_data = json.loads(r.read())
    assert "patient" in report_data and "technical" in report_data
    print(f"[4/6] report JSON ok (patient title: {report_data['patient']['summary']['primary_differential']})")

    # Test PDF download endpoint
    with urllib.request.urlopen(f"{URL}/analysis/{analysis_id}/report/pdf", timeout=15) as r:
        pdf_bytes = r.read()
    assert pdf_bytes.startswith(b"%PDF"), "Response is not a valid PDF binary"
    print(f"[5/6] report PDF ok ({len(pdf_bytes)} bytes)")

    status, err = post_file(b"not an image")
    assert status == 400, (status, err)
    print("[6/6] bad-image -> 400 ok:", err.get("detail"))
    print("\n>>> ALL SMOKE TESTS PASSED SUCCESSFULLY! <<<")
    return 0


if __name__ == "__main__":
    sys.exit(main())
