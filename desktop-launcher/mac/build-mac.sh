#!/usr/bin/env bash
# 拼豆豆仓 · Mac 一键构建脚本
# 在 Mac 上运行：bash build-mac.sh
# 产物：拼豆豆仓.app（双击打开系统默认浏览器访问网站）+ 拼豆豆仓-mac.zip（可分发包）
set -e

APP_NAME="拼豆豆仓"            # .app 文件夹名 / 显示名（Finder 显示为中文）
EXEC_NAME="pindoucang"         # 内部可执行文件名（避免 macOS 对中文 CFBundleExecutable 的已知问题）
URL="https://pindoucang.online"
BUNDLE_ID="online.pindoucang.app"

rm -rf "$APP_NAME.app" "$APP_NAME-mac.zip"
DIR="$APP_NAME.app/Contents"
mkdir -p "$DIR/MacOS"

# 启动脚本：打开默认浏览器访问网站（本质仍是浏览器）
cat > "$DIR/MacOS/$EXEC_NAME" <<'EOF'
#!/usr/bin/env bash
open "__URL__"
EOF
# 用真实地址替换占位符
sed -i '' "s|__URL__|$URL|g" "$DIR/MacOS/$EXEC_NAME"
chmod +x "$DIR/MacOS/$EXEC_NAME"

cat > "$DIR/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>$EXEC_NAME</string>
  <key>LSMinimumSystemVersion</key><string>10.12</string>
</dict>
</plist>
EOF

zip -r "$APP_NAME-mac.zip" "$APP_NAME.app"
echo "✅ 已生成 $APP_NAME.app 和 $APP_NAME-mac.zip"
echo "首次打开若被 Gatekeeper 拦截（无法验证开发者）：右键 App → 打开；或在终端执行 xattr -cr \"$APP_NAME.app\""
