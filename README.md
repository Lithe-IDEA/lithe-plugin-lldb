# LLDB Debugger for Lithe

为 [Lithe](https://github.com/1lck/Lithe-IDEA) 提供 C / C++ / Objective-C / Swift / Rust 调试，调试器是你电脑上的
[`lldb-dap`](https://lldb.llvm.org/resources/lldbdap.html)。这是一个**社区插件**。

> English: Debug C / C++ / Objective-C / Swift / Rust programs in Lithe through your own
> [`lldb-dap`](https://lldb.llvm.org/resources/lldbdap.html). A community plugin.

## 前置条件 / Requirements

- Lithe 需要支持插件 API 4（目前是 preview 开发版，稳定版还没有）。
- `lldb-dap` 在 `PATH` 中。macOS：`xcode-select --install`，或安装 LLVM。插件不内置任何调试器。
- 带调试信息的程序，例如 `clang -g main.c -o main`（`gcc -g` 也可以）。

## 安装 / Install

这个版本是预发布，还没有收录到 Lithe Store：

1. 下载 [Releases](https://github.com/Lithe-IDEA/lithe-plugin-lldb/releases) 里的 `lldb-debug-<版本>-darwin.zip`。
2. 在 Lithe 中打开 **设置 → 插件**，点右上角 ⚙，选择 **从磁盘安装插件…**，选中这个 zip，确认权限后安装。
   Lithe 如果提示需要重启，按提示重启即可。
3. 打开 C / Rust / Swift 文件，设置断点并开始调试。

插件会请求 `debug.launch` 权限，并运行你电脑上的 `lldb-dap`。

## 可执行文件设置 / Program setting

插件不写死程序路径。Lithe 按下面的顺序寻找可执行文件，并把结果回显在插件设置里：

1. `program` 设置，你填了就以它为准。
2. `<当前文件所在目录>/<不带扩展名的文件名>`
3. `<项目根目录>/<不带扩展名的文件名>`
4. `<项目根目录>/build/<不带扩展名的文件名>`

## 控制台 / Console

在调试控制台里输入 `` ` `` 加 lldb 命令（例如 `` `bt``）。命令补全来自插件声明的列表和 `lldb-dap` 自己的补全。

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
