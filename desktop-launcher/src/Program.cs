using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

// 拼豆豆仓 桌面启动器（最简版）
// 行为：
//   1. 若 exe 同目录存在 index.html  -> 用默认浏览器打开本地 file://（离线可用）
//   2. 否则                          -> 打开线上地址（默认 https://pindoucang.online）
//   3. 同目录若有 launcher.cfg，取其第一行作为"线上地址"覆盖默认值
class Program
{
    static void Main()
    {
        string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        string localHtml = Path.Combine(exeDir, "index.html");

        string url;
        if (File.Exists(localHtml))
        {
            // 离线模式：打开同目录的本地网页
            url = "file:///" + localHtml.Replace('\\', '/');
        }
        else
        {
            // 线上模式：默认地址
            url = "https://pindoucang.online";
            string cfg = Path.Combine(exeDir, "launcher.cfg");
            if (File.Exists(cfg))
            {
                string line = File.ReadAllText(cfg).Split('\n')[0].Trim();
                if (line.Length > 0 &&
                    (line.StartsWith("http://") || line.StartsWith("https://") || line.StartsWith("file://")))
                {
                    url = line;
                }
            }
        }

        try
        {
            Process.Start(url);
        }
        catch
        {
            // 兜底：通过 cmd 的 start 打开，兼容性最好
            Process.Start(new ProcessStartInfo("cmd", "/c start \"\" \"" + url + "\"")
            {
                CreateNoWindow = true,
                UseShellExecute = false
            });
        }
    }
}
