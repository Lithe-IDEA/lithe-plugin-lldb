# Lithe lldb-dap debugger plugin

Debug C / C++ / Objective-C / Swift / Rust programs in Lithe through [`lldb-dap`](https://lldb.llvm.org/resources/lldbdap.html).

调用系统里的 `lldb-dap` 为 Lithe 提供 C / C++ / Objective-C / Swift / Rust 调试。

## Requirements / 前置条件

- `lldb-dap` on `PATH` (macOS: `xcode-select --install`, or install LLVM).
- A binary built with debug info, for example `clang -g main.c -o main`.

## Program setting / 可执行文件设置

The plugin does not hard-code a program path. Lithe looks for the binary in this order and shows the result in the plugin settings:

1. The `program` setting, when you set one (it always wins).
2. `<current file directory>/<file name without extension>`
3. `<workspace>/<file name without extension>`
4. `<workspace>/build/<file name without extension>`

## Console / 控制台

Type `` ` `` followed by an lldb command in the debug console (for example `` `bt``). Commands are completed from the plugin's declared list and from `lldb-dap`.
