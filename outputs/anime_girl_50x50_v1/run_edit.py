import os
import sys

# 1) 清空死掉的本地代理，改为直连 97api（国内服务）
for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
    os.environ.pop(k, None)

SKILL = r"C:\Users\木子\.workbuddy\skills\pindou-skill\scripts"
sys.path.insert(0, SKILL)
import edit  # 导入即 load_local_env()，载入 .env 的 API key / base url

IMG = r"E:\workbuddy\拼豆豆仓\测试图\微信图片_20260811111737_22_6.jpg"
PROMPT = open(r"E:\workbuddy\拼豆豆仓\outputs\anime_girl_50x50_v1\image_prompt.txt",
              encoding="utf-8").read().strip()
OUT = r"E:\workbuddy\拼豆豆仓\outputs\anime_girl_50x50_v1"

sys.argv = [
    "edit.py", IMG, PROMPT,
    "--size", "1024x1536",
    "--quality", "medium",
    "--n", "2",
    "--tag", "anime_girl_50x50_v1",
    "--out-dir", OUT,
]
edit.main()
