"""Drive a real terminal program in a Windows pseudo-terminal and record its output stream for screenshots.

Usage: python -I pty_capture.py <script.json> <out_dir>
script.json: {"cmd": "powershell -NoLogo -NoProfile", "cols": 120, "rows": 34, "cwd": "C:\\mods",
              "steps": [ ["wait", "PS C:", 20], ["send", "claude plugin validate .\\blast-radius\\r"], ["sleep", 6], ["snap", "validate"],
                         ["auto", [["Do you trust", "1\\r"]], "goal text", 120], ... ]}
  wait  <text> <timeout>   wait until <text> appears in the ANSI-stripped stream (after the last snap/marker)
  send  <keys>             write keys (\\r = Enter, \\x1b = Esc)
  sleep <s>
  snap  <name>             write <out_dir>/<name>.ansi = every byte received so far (replay it in xterm.js to get the screen)
  auto  [[pattern, keys], …] <goal> <timeout>   answer prompts automatically until <goal> appears
Each .ansi is the whole stream from the start, so a terminal emulator replaying it reaches the exact screen at that moment.
"""
import json, os, re, sys, threading, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from winpty import PtyProcess

script = json.load(open(sys.argv[1], encoding="utf-8"))
out = sys.argv[2]; os.makedirs(out, exist_ok=True)
env = {k: v for k, v in os.environ.items() if not k.startswith(("CLAUDECODE", "CLAUDE_CODE_", "CLAUDE_AGENT", "ANTHROPIC_"))}
env.update({"TERM": "xterm-256color", "COLORTERM": "truecolor", "FORCE_COLOR": "3"})
env.update(script.get("env", {}))
p = PtyProcess.spawn(script["cmd"], dimensions=(script.get("rows", 34), script.get("cols", 120)), cwd=script.get("cwd"), env=env)
buf, lock = [], threading.Lock()
def reader():
    while True:
        try:
            d = p.read(4096)
        except EOFError:
            break
        except Exception:
            time.sleep(0.02); continue
        if d:
            with lock: buf.append(d)
threading.Thread(target=reader, daemon=True).start()
ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[@-Z\\-_]")
mark = 0
def text_since(m):
    # ConPTY sends spaces as cursor moves, so compare with all whitespace removed
    with lock: s = "".join(buf)
    return re.sub(r"\s+", "", ANSI.sub("", s[m:]))
sq = lambda x: re.sub(r"\s+", "", x)
def total():
    with lock: return sum(len(x) for x in buf)
def wait(t, timeout):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if sq(t) in text_since(mark): return True
        time.sleep(0.2)
    print(f"  timeout waiting for {t!r}"); return False
for st in script["steps"]:
    k = st[0]
    if k == "wait": ok = wait(st[1], st[2]); print("wait", st[1], ok)
    elif k == "send":
        p.write(st[1]); print("send", repr(st[1]))
        mark = total()
    elif k == "sleep": time.sleep(st[1])
    elif k == "snap":
        with lock: s = "".join(buf)
        open(os.path.join(out, st[1] + ".ansi"), "w", encoding="utf-8", newline="").write(s)
        print("snap", st[1], len(s), "chars")
    elif k == "auto":
        rules, goal, timeout = st[1], st[2], st[3]; t0 = time.time(); answered = {}
        while time.time() - t0 < timeout:
            tx = text_since(mark)
            if sq(goal) in tx: print("goal", goal); break
            for pat, keys in rules:
                n = tx.count(sq(pat))
                if n > answered.get(pat, 0):
                    time.sleep(0.8); p.write(keys); answered[pat] = n
                    print("auto", pat, "->", repr(keys))
            time.sleep(0.4)
        else:
            print("  auto timeout; goal", goal)
    elif k == "mark": mark = total()
try:
    p.terminate(force=True)
except Exception:
    pass
print("done")
