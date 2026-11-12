# LLDB Debugger for Lithe

<img src="assets/lldb.svg" width="64" height="64" alt="">

为 [Lithe](https://github.com/1lck/Lithe-IDEA) 提供 C / C++ / Objective-C / Swift / Rust 调试，调试器是你电脑上的
[`lldb-dap`](https://lldb.llvm.org/resources/lldbdap.html)。这是一个**社区插件**，用插件契约 v0 的声明式调试适配器接口
（`debugAdapters`）实现：插件只有一份 `plugin.json`，没有后端进程，也不带调试器。

> English: Debug C / C++ / Objective-C / Swift / Rust programs in Lithe through your own
> [`lldb-dap`](https://lldb.llvm.org/resources/lldbdap.html). A community plugin built on the declarative
> `debugAdapters` contract; it is a single `plugin.json` and carries no debugger.

> **预发布**：按插件契约 v0（`schemaVersion: 0`、`pluginAPIVersion: 0`）编写，只能装进新版 Lithe 桌面端
> （`desktop-v*` 预发布），旧版 macOS Lithe 无法安装。

## 依赖的程序

- `lldb-dap`。Lithe 先在 `PATH` 里找，找不到时在 macOS 上用 `xcrun --find lldb-dap` 找 Xcode 自带的版本。
  可以用 `xcode-select --install` 安装 Xcode 命令行工具，或者安装 Xcode 或 LLVM。
- 带调试信息的程序，例如 `clang -g main.c -o main`（`gcc -g` 也可以）。

## 安装

1. 从 [Releases](https://github.com/Lithe-IDEA/lithe-plugin-lldb/releases) 下载 `lldb-debug-<版本>-darwin.zip`。
2. 在 Lithe 中打开 **设置 → 插件**，点击页面标题栏右侧的 **从文件安装…**，选中这个 zip，核对 SHA-256 和权限后确认。

插件会请求 `debug.launch` 权限，用来启动你电脑上的 `lldb-dap`。装好后打开 C / Rust / Swift 文件，设置断点并开始调试。

## 可执行文件设置

插件不写死程序路径。Lithe 按下面的顺序寻找要调试的可执行文件：

1. 插件设置 **Program**（`program`），填写后以它为准；
2. `<当前文件所在目录>/<不带扩展名的文件名>`；
3. `<项目根目录>/<不带扩展名的文件名>`；
4. `<项目根目录>/build/<不带扩展名的文件名>`。

Program 设置按项目保存，修改后从下一次调试开始生效。

## 控制台

在调试控制台里输入 `` ` `` 加 lldb 命令（例如 `` `bt``）。命令补全来自插件声明的列表和 `lldb-dap` 自己的补全。

## 诊断日志

插件没有自己的进程，也不发送 `lithe/log`。`lldb-dap` 由 Lithe 启动，启动成败由 Lithe 记录；
程序输出、调试表达式、变量内容和适配器的原始输出只显示在调试控制台，不写进日志。
排障时使用 Lithe 的日志窗口和诊断导出，并同时检查调试控制台。不要启用 `LLDBDAP_LOG`、完整 DAP 通信转储，
也不要用变量、内存、源码或环境内容补充诊断日志。

## 开发

```text
io.github.lithe-idea.lldb-debug/plugin.json   # 插件描述，目录名必须等于插件 id
scripts/package.mjs                           # 校验清单，打包成 dist/lldb-debug-<版本>-darwin.zip
.github/workflows/ci.yml                      # PR 时打包，并用 Lithe Store 的规则检查
.github/workflows/release.yml                 # 推送 v<版本> 标签时发布 GitHub Release
docs/releases/v<版本>.md                       # 该版本的变化，发布时并入 Release 说明（可选）
```

本地需要 Node.js 22+ 和 `zip`：

```bash
node scripts/package.mjs
```

本地开发时，用 **设置 → 插件 → 从文件安装…** 选择 `dist/lldb-debug-<版本>-darwin.zip` 安装。

`plugin.json` 的完整格式见 Rust Core 仓库里的
[插件契约](https://github.com/Lithe-IDEA/Lithe-core-rust/blob/main/shared/plugins/contract/v1/README.md)
和[调试适配器插件指南](https://github.com/Lithe-IDEA/Lithe-core-rust/blob/main/shared/plugins/guides/debug-adapter-plugin.md)。

## 发布新版本

1. 按语义化版本修改 `plugin.json` 的 `version`：只修 Bug 升修订号，加功能升次版本号，有不兼容的变化升主版本号。
   合入 `main`。
2. 推送同名标签：

   ```bash
   git tag v0.0.1 && git push origin v0.0.1
   ```

3. `Release` 工作流会核对标签与版本、打包并发布 Release（说明里附 SHA-256）。`release.yml` 里 `PRERELEASE_TAGS`
   列出的版本会标为预发布版本：目前是只能装进新版桌面端的 `v0.0.1`。
4. Lithe Store 的自动追踪会发现稳定版本并开合并请求。自动追踪会跳过预发布版本；需要收录时在 Store 中手工提交条目，
   并使用已发布 ZIP 的实际 SHA-256。

## 许可

[Apache-2.0](LICENSE)
