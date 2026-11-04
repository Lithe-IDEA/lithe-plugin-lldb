# LLDB Debugger for Lithe

<img src="assets/lldb.svg" width="64" height="64" alt="">

为 [Lithe](https://github.com/1lck/Lithe-IDEA) 提供 C / C++ / Objective-C / Swift / Rust 调试，调试器是你电脑上的
[`lldb-dap`](https://lldb.llvm.org/resources/lldbdap.html)。这是一个**社区插件**。

> English: Debug C / C++ / Objective-C / Swift / Rust programs in Lithe through your own
> [`lldb-dap`](https://lldb.llvm.org/resources/lldbdap.html). A community plugin.

## 前置条件 / Requirements

- Lithe 需要支持插件 API 4（目前是 preview 开发版，稳定版还没有）。
- `lldb-dap` 在 `PATH` 中。macOS：`xcode-select --install`，或安装 LLVM。插件不内置任何调试器。
- 带调试信息的程序，例如 `clang -g main.c -o main`（`gcc -g` 也可以）。

## 安装 / Install

这个版本是预发布，已收录在 Lithe Store，但只有支持插件 API 4 的 Lithe 才能安装；不支持的版本会提示升级，而不是安装。

**从插件市场安装**：在支持 API 4 的 Lithe 中打开 **设置 → 插件**，在市场里找到 *LLDB Debugger*，确认权限后安装。

**从磁盘安装**：

1. 下载 [Releases](https://github.com/Lithe-IDEA/lithe-plugin-lldb/releases) 里的 `lldb-debug-<版本>-darwin.zip`。
2. 在 Lithe 中打开 **设置 → 插件**，点右上角 ⚙，选择 **从磁盘安装插件…**，选中这个 zip，确认权限后安装。
   Lithe 如果提示需要重启，按提示重启即可。

装好后打开 C / Rust / Swift 文件，设置断点并开始调试。

插件会请求 `debug.launch` 权限，并运行你电脑上的 `lldb-dap`。

## 可执行文件设置 / Program setting

插件不写死程序路径。Lithe 按下面的顺序寻找可执行文件，并把结果回显在插件设置里：

1. `program` 设置，你填了就以它为准。
2. `<当前文件所在目录>/<不带扩展名的文件名>`
3. `<项目根目录>/<不带扩展名的文件名>`
4. `<项目根目录>/build/<不带扩展名的文件名>`

## 控制台 / Console

在调试控制台里输入 `` ` `` 加 lldb 命令（例如 `` `bt``）。命令补全来自插件声明的列表和 `lldb-dap` 自己的补全。

## 诊断日志 / Diagnostic logs

此插件通过宿主的通用 DAP 传输启动 `lldb-dap`，没有独立后端或日志 writer。
结构化日志 v2 的 Core 生命周期和操作分类记录到 `debug/lldb-dap` 通道；
关键生命周期为 INFO，运行/暂停等内部状态为 DEBUG，超时和适配器拒绝为 ERROR，取消不算失败。
原生启动和进程异常退出的固定阶段/退出码记录到 `debug`。程序输出、调试表达式和变量内容属于调试控制台，
不得复制到诊断日志。适配器原始 stderr 仍由宿主调试控制台呈现，不代表已作为 v2 文件持久化。

排障时使用 Lithe 的独立日志窗口和诊断导出，并同时检查调试控制台。
不要启用 `LLDBDAP_LOG`、完整 DAP 通信转储或以变量、内存、源码和环境内容补充诊断日志。
日志文件不得写入插件安装目录。Windows 的日志实现仍为 v1；本文没有声明 Windows 已完成 v2 验收。

## 开发 / Development

```text
io.github.lithe-idea.lldb-debug/plugin.json   # 插件描述，目录名必须等于插件 id
scripts/package.mjs                           # 校验清单，打包成 dist/lldb-debug-<版本>-darwin.zip
.github/workflows/ci.yml                      # PR 时打包，并用 Lithe Store 的规则检查
.github/workflows/release.yml                 # 推送 v<版本> 标签时发布 GitHub Release（预发布）
```

插件开发资料见 [lithe-plugin-docs](https://github.com/Lithe-IDEA/lithe-plugin-docs)。
发布新版本：递增 `plugin.json` 的 `version`，推送对应的 `v<版本>` 标签。

## 许可 / License

[Apache-2.0](LICENSE)
