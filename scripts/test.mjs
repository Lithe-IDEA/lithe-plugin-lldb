#!/usr/bin/env node
// Runs what plugin.json declares with the real programs, the way Lithe runs them, on a
// C program built with clang -g under a path with a space:
//
// - a debug session with the lldb-dap Lithe finds without installing anything (PATH,
//   then `xcrun --find lldb-dap`): a breakpoint stops on its line, a local variable reads
//   back and the program runs to a clean exit;
// - the lldb-dap installer: Homebrew is found the way its tool definition says (brew on
//   PATH, then the declared install locations), answers the version probe, runs the
//   declared install, and the directory probe names the directory lldb-dap lands in;
// - the same debug session with that installed lldb-dap.
//
// LITHE_TEST_INSTALL=0 skips the install, which downloads LLDB and the LLVM it depends on
// (several hundred MB).
//
// Usage: node scripts/test.mjs

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

const manifest = JSON.parse(readFileSync("io.github.lithe-idea.lldb-debug/plugin.json", "utf8"));
const adapter = manifest.debugAdapters.find((entry) => entry.id === "lldb");
const installer = manifest.commandInstallers.find((entry) => entry.id === "lldb-dap");
const brewTool = manifest.toolDefinitions.find((entry) => entry.id === installer.tool);
const WAIT_MS = 60_000;

function run(command, args, { cwd, timeout = 10 * 60_000 } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`${command} ${args.join(" ")}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status ?? result.signal}\n${result.stdout}${result.stderr}`);
  }
  return result.stdout;
}

let failed = false;
async function check(name, body) {
  const started = Date.now();
  try {
    await body();
    console.log(`✓ ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${name}\n${error.stack}`);
  }
}

/** A Debug Adapter Protocol client over the adapter's stdio, as the stdio transport speaks it. */
class Dap {
  constructor(child) {
    this.child = child;
    this.seq = 1;
    this.pending = new Map();
    this.events = [];
    this.waiters = [];
    this.log = "";
    let buffer = Buffer.alloc(0);
    child.stdout.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const end = buffer.indexOf("\r\n\r\n");
        if (end < 0) return;
        const length = Number(/Content-Length: *(\d+)/i.exec(buffer.subarray(0, end).toString())?.[1]);
        if (buffer.length < end + 4 + length) return;
        const message = JSON.parse(buffer.subarray(end + 4, end + 4 + length).toString());
        buffer = buffer.subarray(end + 4 + length);
        this.receive(message);
      }
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { this.log += chunk; });
    child.once("exit", (code, signal) => {
      const error = new Error(`lldb-dap exited with ${code ?? signal}\n${this.log}`);
      for (const { reject } of this.pending.values()) reject(error);
      for (const { reject } of this.waiters) reject(error);
    });
  }

  receive(message) {
    if (message.type === "response") {
      const pending = this.pending.get(message.request_seq);
      this.pending.delete(message.request_seq);
      if (message.success) pending?.resolve(message.body ?? {});
      else pending?.reject(new Error(`${message.command} failed: ${message.message ?? ""} ${JSON.stringify(message.body ?? {})}`));
    } else if (message.type === "event") {
      if (message.event === "output") this.log += message.body?.output ?? "";
      this.events.push(message);
      this.waiters = this.waiters.filter((waiter) => !waiter.take());
    }
  }

  request(command, args = {}) {
    const seq = this.seq++;
    const body = JSON.stringify({ seq, type: "request", command, arguments: args });
    this.child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    return this.within(`the ${command} response`, new Promise((resolve, reject) => this.pending.set(seq, { resolve, reject })));
  }

  /** The first event named `name` that has not been taken yet and matches `accept`. */
  event(name, accept = () => true) {
    return this.within(`a ${name} event`, new Promise((resolve, reject) => {
      const waiter = {
        reject,
        take: () => {
          const index = this.events.findIndex((event) => event.event === name && accept(event.body ?? {}));
          if (index < 0) return false;
          resolve(this.events.splice(index, 1)[0].body ?? {});
          return true;
        },
      };
      if (!waiter.take()) this.waiters.push(waiter);
    }));
  }

  within(what, promise) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no ${what} within ${WAIT_MS / 1000} s\n${this.log}`)), WAIT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }
}

/** Launches the program under `lldbDap` with the configuration plugin.json declares and debugs it. */
async function debugSession(lldbDap, program, source, line) {
  assert.equal(adapter.launch.transport, "stdio");
  const child = spawn(lldbDap, adapter.launch.process.arguments ?? [], { stdio: ["pipe", "pipe", "pipe"] });
  const dap = new Dap(child);
  try {
    await dap.request("initialize", {
      clientID: "lithe-test", adapterID: adapter.adapterID, pathFormat: "path",
      linesStartAt1: true, columnsStartAt1: true,
    });
    // The host sends the declared arguments plus the bound program and working directory.
    const { arguments: declared, targetBindings } = adapter.configurations.launch;
    assert.deepEqual(targetBindings, { program: "target.executable", cwd: "target.workingDirectory" });
    const launched = dap.request("launch", { ...declared, program, cwd: join(program, "..") });
    await dap.event("initialized");
    const { breakpoints } = await dap.request("setBreakpoints", { source: { path: source }, breakpoints: [{ line }] });
    assert.equal(breakpoints.length, 1);
    await dap.request("configurationDone");
    await launched;
    const stopped = await dap.event("stopped");
    assert.equal(stopped.reason, "breakpoint", JSON.stringify(stopped));
    const { stackFrames } = await dap.request("stackTrace", { threadId: stopped.threadId, levels: 1 });
    assert.equal(stackFrames[0].line, line);
    assert.equal(realpathSync(stackFrames[0].source.path), realpathSync(source));
    const { scopes } = await dap.request("scopes", { frameId: stackFrames[0].id });
    const locals = scopes.find((scope) => /local/i.test(scope.name)) ?? scopes[0];
    const { variables } = await dap.request("variables", { variablesReference: locals.variablesReference });
    assert.equal(variables.find((variable) => variable.name === "answer")?.value, "42", JSON.stringify(variables));
    await dap.request("continue", { threadId: stopped.threadId });
    const exited = await dap.event("exited");
    assert.equal(exited.exitCode, 0);
    await dap.request("disconnect", { terminateDebuggee: true }).catch(() => {});
  } finally {
    child.kill();
  }
}

/** The lldb-dap Lithe finds before offering the installer: PATH, then xcrun on macOS. */
function systemLldbDap() {
  const command = adapter.launch.process.launch.commands[0];
  const onPath = spawnSync("/usr/bin/which", [command], { encoding: "utf8" });
  if (onPath.status === 0) return onPath.stdout.trim();
  return run("xcrun", ["--find", command]).trim();
}

/** Homebrew the way its tool definition finds it: brew on PATH, then the declared install locations. */
function findBrew() {
  const command = brewTool.executables.find((entry) => entry.kind === "command").command;
  const onPath = spawnSync("/usr/bin/which", [command], { encoding: "utf8" });
  if (onPath.status === 0) return onPath.stdout.trim();
  const layout = brewTool.executableLayouts.find((entry) => entry.platforms.includes("macos")).path;
  for (const scan of brewTool.discovery.filter((entry) => entry.platforms.includes("macos"))) {
    assert.doesNotMatch(scan.pattern, /\*/, "the discovery patterns are literal directories");
    const candidate = join(scan.root.path, scan.pattern, layout);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("no Homebrew where the tool definition looks");
}

const scratch = realpathSync(mkdtempSync(join(tmpdir(), "lithe-lldb-test-")));
try {
  const root = join(scratch, "Lithe LLDB Demo");
  mkdirSync(root);
  const source = join(root, "main.c");
  const line = 5;
  writeFileSync(source, [
    "#include <stdio.h>",
    "",
    "int main(void) {",
    "  int answer = 42;",
    '  printf("answer %d\\n", answer);',
    "  return 0;",
    "}",
    "",
  ].join("\n"));
  const program = join(root, "main");
  run("clang", ["-g", "-O0", source, "-o", program]);

  await check("the lldb-dap found on PATH or through xcrun debugs a program", async () => {
    const lldbDap = systemLldbDap();
    console.log(`  ${lldbDap}`);
    await debugSession(lldbDap, program, source, line);
  });

  if (process.env.LITHE_TEST_INSTALL === "0") {
    console.log("- skipped the lldb-dap install (LITHE_TEST_INSTALL=0)");
  } else {
    let brew;
    await check("Homebrew is found where the tool definition looks and answers the version probe", () => {
      brew = findBrew();
      const output = run(brew, brewTool.version.arguments);
      const match = output.match(new RegExp(brewTool.version.pattern));
      assert.ok(match, `no version in ${JSON.stringify(output)}`);
      console.log(`  ${brew} ${match[1]}`);
    });

    let installed;
    await check(`the ${installer.id} installer puts ${installer.commands.join(", ")} where its directory probe says`, () => {
      assert.ok(brew, "needs Homebrew");
      assert.deepEqual(Object.keys(installer.targets), ["toolDefault"]);
      run(brew, installer.arguments, { timeout: installer.timeoutSeconds * 1000 });
      const [probe] = installer.targets.toolDefault.directory;
      const prefix = run(brew, probe.arguments).trim();
      assert.ok(isAbsolute(prefix), `brew ${probe.arguments.join(" ")} printed ${JSON.stringify(prefix)}`);
      const directory = join(prefix, probe.append ?? "");
      for (const command of installer.commands) {
        const listing = existsSync(directory) ? readdirSync(directory).join(" ") : "(missing)";
        assert.ok(existsSync(join(directory, command)), `${command} in ${directory}, which holds: ${listing}`);
      }
      installed = join(directory, installer.commands[0]);
    });

    await check("the installed lldb-dap debugs a program", async () => {
      assert.ok(installed, "needs the installed lldb-dap");
      console.log(`  ${installed}`);
      await debugSession(installed, program, source, line);
    });
  }
} catch (error) {
  failed = true;
  console.error(error.stack);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
