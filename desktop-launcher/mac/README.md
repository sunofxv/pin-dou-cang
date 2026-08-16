# 拼豆豆仓 · Mac 构建脚本

这是一个纯 shell 脚本，用于在 Mac 上把「拼豆豆仓」打包成一个打开浏览器的 `.app`（本质仍是浏览器，零额外依赖）。

## 用法
1. 解压 `mac-build.zip`
2. 打开「终端」，进入解压目录
3. 运行：`bash build-mac.sh`
4. 得到 `拼豆豆仓.app` 和 `拼豆豆仓-mac.zip`

## 安装
- 把 `拼豆豆仓.app` 拖到「应用程序」文件夹即可。
- 首次打开若被 Gatekeeper 拦截（提示「无法验证开发者」）：
  - 右键 App → 打开；或
  - 终端执行 `xattr -cr /Applications/拼豆豆仓.app`

## 说明
双击 App 会调用系统默认浏览器打开 https://pindoucang.online。若要改成打开本地离线文件，把网站文件与 App 放一起并修改脚本里的 `URL` 即可。
