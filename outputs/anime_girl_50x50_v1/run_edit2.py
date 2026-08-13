import os, sys, base64, json, datetime, urllib.request, urllib.error

# 1) 清空死掉的本地代理，直连 97api（国内服务）
for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
    os.environ.pop(k, None)

# 2) 从 .env 解析 API key / base url（不打印值）
env = {}
for line in open(r"C:\Users\木子\.workbuddy\skills\pindou-skill\scripts\.env", encoding="utf-8").read().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip()

KEY = env["IMAGE_API_KEY"]
BASE = env.get("OPENAI_BASE_URL", "https://images.97api.com/v1").rstrip("/")
URL = BASE + "/images/edits"

IMG = r"E:\workbuddy\拼豆豆仓\测试图\微信图片_20260811111737_22_6.jpg"
PROMPT = open(r"E:\workbuddy\拼豆豆仓\outputs\anime_girl_50x50_v1\image_prompt.txt", encoding="utf-8").read().strip()
OUT = r"E:\workbuddy\拼豆豆仓\outputs\anime_girl_50x50_v1"
os.makedirs(OUT, exist_ok=True)

# 3) 按 97api 文档：图生图 multipart，必填 aspect_ratio 且与 size 匹配 (2:3 <-> 1024x1536)
mime = "image/jpeg" if IMG.lower().endswith((".jpg", ".jpeg")) else "image/png"
with open(IMG, "rb") as f:
    img_bytes = f.read()

files = {"image": ("input.jpg", img_bytes, mime)}
data = {
    "model": "gpt-image-2",
    "prompt": PROMPT,
    "size": "1024x1536",
    "aspect_ratio": "2:3",
    "quality": "medium",
    "n": "2",
    "response_format": "url",
}
headers = {"Authorization": f"Bearer {KEY}", "Accept": "application/json"}

# 3.5) 用 stdlib urllib 手写 multipart/form-data（避免额外依赖）
boundary = "----97apiFormBoundary7Q3k"
buf = []
for name, val in data.items():
    buf.append(f"--{boundary}\r\n".encode())
    buf.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
    buf.append(str(val).encode("utf-8"))
    buf.append(b"\r\n")
buf.append(f"--{boundary}\r\n".encode())
buf.append(f'Content-Disposition: form-data; name="image"; filename="input.jpg"\r\n'.encode())
buf.append(f"Content-Type: {mime}\r\n\r\n".encode())
buf.append(img_bytes)
buf.append(b"\r\n")
buf.append(f"--{boundary}--\r\n".encode())
body = b"".join(buf)

req = urllib.request.Request(URL, data=body, method="POST")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
req.add_header("Authorization", f"Bearer {KEY}")
req.add_header("Accept", "application/json")
req.add_header("User-Agent", UA)

print(f"[req] POST {URL}", file=sys.stderr)
try:
    with urllib.request.urlopen(req, timeout=300) as r:
        status = r.status
        text = r.read().decode("utf-8", "replace")
except urllib.error.HTTPError as e:
    status = e.code
    text = e.read().decode("utf-8", "replace")

print(f"[resp] status={status}", file=sys.stderr)
print(text[:2000], file=sys.stderr)

if status != 200:
    raise SystemExit(f"[edit2] API 错误 {status}")

j = json.loads(text)
# 存原始响应备查
open(os.path.join(OUT, "last_response.json"), "w", encoding="utf-8").write(text)
items = j.get("data", [])
print(f"[info] 返回 data 条数 = {len(items)}", file=sys.stderr)
saved = []
for i, item in enumerate(items):
    if item.get("b64_json"):
        raw = base64.b64decode(item["b64_json"])
    elif item.get("url"):
        req2 = urllib.request.Request(item["url"], headers={"User-Agent": UA})
        with urllib.request.urlopen(req2, timeout=120) as r2:
            raw = r2.read()
    else:
        print(f"[warn] item {i} 既无 b64_json 也无 url", file=sys.stderr)
        continue
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    p = os.path.join(OUT, f"{ts}_edit_anime_girl_50x50_v1_{i}.png")
    open(p, "wb").write(raw)
    saved.append(p)
    print(f"[saved] -> {p}", file=sys.stderr)
    print(p)

if not saved:
    raise SystemExit("[edit2] 没有返回任何图片")
