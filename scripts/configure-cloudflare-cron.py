import json
import os
import pathlib
import urllib.request
import uuid

cron = "17 1,4,7,10,13,16,19,22 * * *"
account = os.environ["CLOUDFLARE_ACCOUNT_ID"]
token = os.environ["CLOUDFLARE_API_TOKEN"]
base = f"https://api.cloudflare.com/client/v4/accounts/{account}/workers/scripts/dailyreview-cron"


def api(url, method="GET", body=None, content_type="application/json"):
    request = urllib.request.Request(
        url, data=body, method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": content_type},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        result = json.load(response)
    if not result.get("success"):
        raise RuntimeError("Cloudflare rejected the operation")
    return result.get("result")


settings = api(base + "/settings")
bindings = settings.get("bindings", [])
if not any(b.get("name") == "GITHUB_TOKEN" for b in bindings):
    raise RuntimeError("Existing Worker has no GITHUB_TOKEN binding")
metadata = {
    "main_module": "worker.js",
    "compatibility_date": settings.get("compatibility_date") or "2026-09-04",
    "keep_bindings": ["secret_text"],
    "bindings": [binding for binding in bindings if binding["type"] != "secret_text"],
}
boundary = uuid.uuid4().hex
parts = []
for name, filename, content_type, content in [
    ("metadata", None, "application/json", json.dumps(metadata)),
    ("worker.js", "worker.js", "application/javascript+module",
     pathlib.Path("cloudflare/dailyreview-cron-hot-news.js").read_text()),
]:
    disposition = f'form-data; name="{name}"'
    if filename:
        disposition += f'; filename="{filename}"'
    parts.append(f"--{boundary}\r\nContent-Disposition: {disposition}\r\n"
                 f"Content-Type: {content_type}\r\n\r\n{content}\r\n")
body = ("".join(parts) + f"--{boundary}--\r\n").encode()
api(base, "PUT", body, f"multipart/form-data; boundary={boundary}")
api(base + "/schedules", "PUT", json.dumps([{"cron": cron}]).encode())
actual = api(base + "/schedules")
if cron not in json.dumps(actual):
    raise RuntimeError("Cloudflare schedule verification failed")
print("Verified existing dailyreview-cron schedule:", cron)
