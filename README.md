# souljabrewlauncher2

Maintained by **RavensClawX**, ruined by **DeadSpecimen**.
> Original readme included below, please read if you have not used the original
> launcher already. This "theme" was made as a joke and will not be maintained, it is
> just for fun. Enjoy :)

**First time? Follow [Getting Started](docs/GETTING_STARTED.md)** for the complete
Pico setup, SmileBASIC entry and first launch. Prebuilt GPU assets are included;
you do not need to compile the launcher to run it.

A homebrew app launcher running through **SmileBASIC on Nintendo Switch 2**.
Browse apps on the console, launch independent GPU programs, and return to the
menu. The included **Hello World** app is a complete starting point for your own
software, including source, build script, icon, input handling, and an exit path.

The computer hosts the app library and keeps the bridge alive. Application logic
runs in compute shaders and graphics run in vertex/fragment shaders on the
console GPU. This is a GPU app environment, not an NRO loader, native ARM64 app
loader, standalone installed title, or custom firmware.

The included **[HB SDK](sdk/README.md)** provides shared shader/build helpers,
controller and motion input, Joy-Con 2 optical mouse input, keyboard/mouse
telemetry, frequency/amplitude vibration envelopes,
read-only NFC scanning and console-side UDP. The launcher itself is its
integration example: move a detached Joy-Con 2 on a surface to control its
cursor. **L/R** clicks with the corresponding Joy-Con in mouse mode; **ZR**
also clicks. See the
[capability matrix](sdk/docs/capabilities.md) for tested features and hardware
limitations, and the [service protocol](sdk/docs/services.md) for app APIs.

## Contents

- [Requirements](#requirements)
- [Setup](#setup)
- [Launch and controls](#launch-and-controls)
- [SDK guide and API reference](sdk/README.md)
- [Build your own app](#build-your-own-app)
- [Package manifest](#package-manifest)
- [GPU programming interface](#gpu-programming-interface)
- [Input](#input)
- [Graphics and assets](#graphics-and-assets)
- [Audio](#audio)
- [Advanced compute and memory](#advanced-compute-and-memory)
- [Testing and troubleshooting](#testing-and-troubleshooting)
- [Project layout](#project-layout)
- [Credits](#credits)

## Requirements

The supported console configuration is **SmileBASIC 4.4.9 on Switch 2 system
software 23.0.1**. The bridge uses version-specific addresses and checks; other
versions are not supported. Keep more than 20 MiB free in the SmileBASIC save.

You also need:

- A Linux computer on a network reachable by the console and Pico. Linux x86-64
  is the tested host platform.
- A Raspberry Pi **Pico 2 W**, a USB data cable, and CircuitPython. The keyboard
  bridge was used with CircuitPython 10.3.1.
- Node.js 22+, Bash, Python 3 with Pillow, DejaVu Sans, and `spirv-val`.
- For shader builds: `glslangValidator`.
- For desktop GPU tests: a C compiler, Vulkan development headers, a Vulkan
  loader, and a driver (Mesa's software driver is suitable).

On Ubuntu/Debian, after installing Node.js 22+:

```sh
sudo apt-get update
sudo apt-get install python3-pil fonts-dejavu-core glslang-tools spirv-tools \
  build-essential libvulkan-dev mesa-vulkan-drivers
node --version
```

No npm packages are required. Tools are normally found on `PATH`. Optional local
copies in `tools/` are supported but are not distributed. `NODE`, `GLSLANG`,
`SPIRV_VAL`, and `CC` override the corresponding tool paths. Set `NODE` to an
executable path, not a command with arguments.

## Setup

### 1. Prepare the Pico

Download CircuitPython for the [Pico 2 W](https://circuitpython.org/board/raspberry_pi_pico2_w/).
Hold BOOTSEL while attaching the Pico to your computer, copy the board's UF2 to
its bootloader drive, and wait for it to restart as `CIRCUITPY`.

From the repository root, run this with your actual mounted drive and computer
LAN address:

```sh
bash smilebasic/pico-keyboard/install.sh /media/your-user/CIRCUITPY 192.168.1.10
```

The installer prompts for Wi-Fi credentials. It installs the HID library,
`boot.py`, `code.py`, and `program.bas`, writes `settings.toml` on the Pico, and
creates a private pairing key at `smilebasic/pico-keyboard/secret`. Keep the key;
the host and Pico must agree. Do not share the key or `settings.toml`.

After installation, ground **GP0 to GND before connecting** whenever you need
maintenance access to `CIRCUITPY`. Without GP0 grounded the device exposes a USB
keyboard instead. BOOTSEL is for firmware installation, not routine file updates.
Remove the GP0 jumper before connecting the Pico to the console.

### 2. Save the bootstrap in SmileBASIC

Set the console's USB keyboard language to **English (US)**. In SmileBASIC's
program editor, enter [smilebasic/bootstrap.bas](smilebasic/bootstrap.bas) into
slot 0 and save it as **NS2**.

The Pico can type it for you: focus an empty `EDIT0` editor, ground **GP1 to GND**,
and attach the Pico to the console. It waits before typing `program.bas`; allow
roughly eight minutes and then save as NS2. Disconnect and remove the GP1 jumper.
Do not use bootstrap-entry mode while a different text field is focused.

### 3. Prepare the host

Allow inbound TCP **39380** (console bridge) and **39381** (Pico keyboard bridge)
on your local network. The Pico and console independently connect to the host.
Guest-network isolation can prevent this even when Wi-Fi appears connected.
The internal RPC service listens on loopback and uses a per-session token.

## Launch and controls

1. Start a fresh console/SmileBASIC session and open **Direct mode**.
2. Run from the repository root, substituting the computer's LAN address:

   ```sh
   ./start.sh 192.168.1.10
   ```

3. Connect the configured Pico to the console with GP0/GP1 ungrounded.
4. The Pico loads NS2, runs the bootstrap, issues `REMOVE`, and enters the fresh
   connection command. The expected `Out of memory` response to `REMOVE` is part
   of this sequence. Let it finish. The host checks the session, creates the
   display, uploads the catalog/music, and starts the launcher.
5. Keep the host running and computer awake throughout the session.

Use **D-pad Up/Down** or the **left stick** to select an app, then **A** to open it.
You can also tap an app row. The top-right refresh control rescans the host's
app folders; the speaker control toggles menu music. D-pad Left/Right do not
change the catalog.
Joy-Con 2 optical movement controls the cursor; **L/R** clicks while the
corresponding Joy-Con is tracking, and **ZR** also clicks a hovered row, Refresh,
or the speaker. The cursor hides when optical tracking stops. The launcher has no separate System menu.
Hello World uses **B** or **Minus** to return to the menu. Other apps define their
own controls and must implement a return action.

Press **Ctrl+C** in the host terminal to stop its processes. Console allocations
are retained for the session; restart SmileBASIC/the console to release them.
After a failed native session, restart the console before retrying. Never repeat
`REMOVE` within the same application process or reuse an old session's addresses.

## Build your own app

### Generate an app with the SDK

```sh
node sdk/create-app.cjs my-app "My App"
```

The generator copies the working Hello World source, sets the ID and display
name, and refuses to overwrite an existing folder. Edit its description/version
in `app.json`. See [the SDK guide](sdk/README.md) for input helpers, motion,
networking, NFC, vibration, shader examples and the exact memory protocol.

The example is deliberately small:

| File | What to change |
| --- | --- |
| `app.json` | Name, ID, version, icon and asset paths |
| `shaders/app.comp` | Per-frame logic and controller handling |
| `shaders/app.frag` | Screen rendering |
| `shaders/app.vert` | Full-screen triangle; normally leave it alone |
| `assets.py` | Text atlas and terminal-style icon generation |
| `build.cjs` | Initial state and shader compilation |
| `check.cjs` in Hello World | Reference desktop render and input regression checks |

Edit the greeting strings in `assets.py`, replace its icon drawing with your own
art, and edit `app.frag` to change the screen. The builder regenerates the icon,
so edit the generator or remove that generation step before supplying a custom PNG.

Build from the repository root:

```sh
node apps/my-app/build.cjs
```

The build copies the shared ABI/drawing helpers, writes the initial state,
generates assets, compiles the three shaders for Vulkan 1.0, and validates their
SPIR-V. Generated `.spv`, `.bin`, and `.png` files are part of the distributable
app. Include them alongside `app.json`; users should not have to compile an app
just to install it. Keep source and build scripts with your package for others
to learn from or modify.

### Install, refresh, and iterate

Apps live in immediate subdirectories of `apps/`. Copy an app folder there and
tap Refresh in the launcher. Hidden directories are ignored. To use another
library, launch with an absolute path:

```sh
HB_APPS_DIR=/absolute/path/to/my-library ./start.sh 192.168.1.10
```

Return to the menu before rebuilding an app, then refresh and relaunch. The host
fingerprints manifests and assets. It rejects a package that changed between
scan and launch, and caches pipelines for unchanged versions. Each launch resets
app state and optional private memory to their packaged initial values.

The catalog accepts at most **32 apps**. Invalid folders are listed under
`catalog.rejected` in `runs/launcher-*/app-runtime.json`; a bad package does not
prevent valid apps from appearing. To inspect validation directly:

```sh
node -e "const c=require('./homebrew-launcher/app-catalog.cjs');c.scan().then(x=>console.log(JSON.stringify(c.summary(x),null,2)))"
```

## Package manifest

A minimal complete package uses:

```json
{
  "format": "hblauncher.gpu-app",
  "abi": 1,
  "id": "my-app",
  "name": "My App",
  "version": "1.0.0",
  "description": "What this app does",
  "icon": "assets/icon.png",
  "initialState": "assets/state.bin",
  "data": "assets/text.bin",
  "shaders": {
    "vertex": "app.vert.spv",
    "fragment": "app.frag.spv",
    "compute": "app.comp.spv"
  }
}
```

All asset paths are relative to the package directory. Absolute paths, `..`, and
symlinks escaping the package are rejected.

| Field | Contract |
| --- | --- |
| `format`, `abi` | Exactly `hblauncher.gpu-app` and `1` |
| `id` | 1–48 lowercase letters, digits, or hyphens; first character alphanumeric |
| `name` | Nonempty, at most 64 characters |
| `version` | String, at most 32 characters; use semantic versions by convention |
| `description` | String, at most 160 characters |
| `icon` | Valid PNG, at most 2 MiB and 4096×4096; square artwork recommended |
| `initialState` | Exactly 1024 bytes |
| `data` | Nonempty binary data, at most 7 MiB |
| `shaders` | Each SPIR-V file ≤1 MiB with a `main` entry of the correct stage |
| `transition` | Optional `fade` (default behavior) or `none` |
| `audio` | Optional sound effects, described below |
| `memory` | Optional private storage buffer, described below |
| `computeSequence` | Optional multi-pass compute, described below |

The JSON manifest itself is limited to 16 KiB. Host service extensions are not
supported; omit `service`.

## GPU programming interface

The launcher owns the Vulkan device, swapchain, command submission, controller
polling, and app switching. An app supplies shaders and data, not host JavaScript.
The package's build script runs on the developer's PC only; installing a package
does not execute that script.

The runtime binds a **24 MiB storage buffer at set 0, binding 0** (the launcher
menu uses part of it for packed background/title artwork). All three stages
can access it. The first 1024 bytes are the ABI state; `data` begins at byte 1024.
The copied `shaders/abi.glsl` gives an exact `std430` declaration. Do not reorder,
resize, or remove its fields. Some names reflect the original game example; the
byte layout is the public contract.

| Byte offset | GLSL field | Purpose |
| --- | --- | --- |
| 0–63 | `raw[4]` | Controller input; overwritten every frame |
| 64–79 | `motion` | Example timing/UI values; `motion.x` is elapsed simulated seconds |
| 80–95 | `state` | Example state; `state.y` holds previous buttons, `state.z` frame count |
| 96–111 | `refresh` | Menu refresh bookkeeping; leave intact unless your app needs it |
| 112–127 | `library` | Menu values; `library.z` at 120 preserves manual mute |
| 128–783 | `touch[164]` | Touch input; overwritten every frame |
| 784–959 | `game`, `piece`, `flow`, `bagMeta`, `bag`, `rows` | App-owned working state |
| 960–975 | `transition` | `x`: fade opacity; other components reserved for transition conventions |
| 976–991 | `events` | `x`: sound event sequence, `y`: sound effect ID |
| 992–1007 | `stats` | Additional app-owned state |
| 1008–1023 | `reserved` | Runtime messages; see below |
| 1024 onward | `atlas[]` | App data as 32-bit words; use your own packing convention |

The host clears the full shared buffer when loading an app, copies initial state
and data, preserves the user's mute flag, and clears launch/exit requests.
App state is transient: there is no persistence/save API.

### Compute and exit

The default pipeline dispatches **one workgroup `(1,1,1)` per frame**, then draws
a full-screen triangle. Start with `layout(local_size_x=1) in;`. More local
invocations require explicit synchronization and race-free state ownership;
there is no configurable dispatch grid in this ABI.

```glsl
#version 450
#extension GL_GOOGLE_include_directive : require
layout(local_size_x=1) in;
#include "abi.glsl"

void main() {
    uint buttons = c.raw[0].z;
    uint pressed = buttons & ~c.state.y;
    c.motion.x += 1.0 / 60.0;
    c.state.z++;
    c.transition.x = max(0.0, c.transition.x - 1.0 / 15.0);
    bool connected = (c.raw[2].x & 1u) != 0u;
    if (connected && (pressed & (2u | 2048u)) != 0u)
        c.reserved.z = 1u; // B or Minus requests return to the menu
    c.state.y = buttons;
}
```

`reserved.y` (byte 1012) is the menu's one-based launch request. Apps should not
write it. `reserved.z` (byte 1016) requests exit when nonzero. The host checks
requests at a **60-frame cycle boundary**, so switching can take about a second.
Rendering repeats on-console without waiting for a host poll between cycles.
App switches and explicit service requests pause the worker at a boundary.
Keep the exit request set until the host processes it. Do not zero it next frame.
`reserved.w` is the menu's installed count, not app storage.

A typical app starts with float `1.0` at offset 960 and gradually reduces it to
zero. Multiply rendered RGB by `1.0 - c.transition.x` to fade in. With
`transition: "none"`, the runtime initializes that opacity to zero. A manifest
alone cannot add a visual fade to shaders that ignore opacity.

The example's `1/60` timestep is a simulation convention, not a measured delta.
The loop reports continuous cycle intervals; exact scanout timing is not guaranteed.

## Input

`c.raw[0].z` contains the low 32 controller button bits. Use `buttons & ~previous`
for a new press and update `previous` after processing input.

| Bit | Button |
| --- | --- |
| 0, 1, 2, 3 | A, B, X, Y |
| 4, 5 | Left/right stick click |
| 6, 7, 8, 9 | L, R, ZL, ZR |
| 10, 11 | Plus, Minus |
| 12, 13, 14, 15 | D-pad Left, Up, Right, Down |

Left stick X/Y are `int(c.raw[1].x)` / `int(c.raw[1].y)`; right stick X/Y are
`int(c.raw[1].z)` / `int(c.raw[1].w)`. Convert to signed integers before normalizing
by `32767.0`, clamp to `[-1,1]`, and apply your own deadzone. Positive Y is up.
`(c.raw[2].x & 1u) != 0u` indicates connection. The current runtime polls the
handheld controller ID (32); separate multiplayer controller enumeration is not
implemented.

Touch count is `c.touch[2]`. For contact `i` (0–15), the entry advances by ten
32-bit words: attributes `touch[6+10*i]`, ID `touch[7+10*i]`, X
`touch[8+10*i]`, Y `touch[9+10*i]`. Bit 1 of attributes indicates an ending
contact. Coordinates use a 1280×720 space; multiply by 1.5 to match the 1920×1080
render target. Bound contact count to 16 and distinguish contacts using IDs.

## Graphics and assets

Vertex and fragment shaders use `#version 450`; includes need
`GL_GOOGLE_include_directive`. Every stage entry point is `main`. The renderer
calls `vkCmdDraw` with three vertices, no vertex buffers, and no depth buffer.
The example vertex shader derives a full-screen triangle from `gl_VertexIndex`.

Fragment shaders write `layout(location=0) out vec4 outColor`. Render at
1920×1080 using `gl_FragCoord.xy`; the example uses top-left-style screen
coordinates. The pipeline has no app-configurable textures, blending state,
mesh uploads, or push constants. Draw procedurally or read packed pixel data
from storage. Keep fragment buffers `readonly` where possible.

Hello World's atlas is a 1024×2048 grayscale image packed into `data`. Its
`draw.glsl` helper extracts a byte from `c.atlas[]` and treats it as text opacity.
`assets.py` rasterizes font glyphs at build time and generates rectangle constants
in `shaders/text.glsl`. There is no console font dependency. You can replace this
format entirely; the runtime treats `data` as opaque bytes.

Icons are separate PNG files rasterized into the menu catalog on the PC. A
256×256 RGBA source works well; the menu scales the artwork down.

## Audio

At startup the menu plays `homebrew-launcher/audio/intro.pcm` once, then starts
`homebrew-launcher/audio/loop.pcm`, which repeats until an app launches or the
launcher closes. Menu music pauses while an app is active and resumes on return
unless manually muted. Both files are raw stereo, interleaved signed 16-bit
little-endian PCM at 48 kHz without WAV headers; each must be nonempty and
divisible by four bytes, and together they may not exceed ten minutes.
Replace either file to change the menu music. An app can supply short sound effects:

```json
"audio": {
  "sampleRate": 48000,
  "channels": 2,
  "format": "s16le",
  "effects": { "1": "sounds/click.pcm", "2": "sounds/confirm.pcm" }
}
```

Files are raw stereo, interleaved signed 16-bit little-endian PCM at 48 kHz,
without WAV headers. Each must be nonempty, divisible by four bytes, and no more
than 131072 bytes (about 0.68 seconds). IDs are integers 1–31 expressed as JSON
keys. Emit an event by setting `c.events.y` to the ID and incrementing
`c.events.x`. The host polls the event sequence; rapid events can coalesce, so
this is not a sample-accurate sequencer or app music streaming API. Sound effects
are played by the host's console audio worker. Hello World has no effects.

## Advanced compute and memory

Most apps need only the shared buffer. For additional state, request a private
storage buffer at **set 0, binding 1**:

```json
"memory": {
  "bytes": 1048576,
  "initial": "assets/memory.bin"
}
```

`bytes` must be a multiple of 4096, between 4096 and 33554432 (32 MiB). The initial
file must be nonempty and fit the allocation; the remaining bytes are zeroed.
Optional `"encoding": "deflate"` accepts a zlib-wrapped deflate stream, as produced
by Node's `zlib.deflateSync`. The runtime restores initial memory on each launch.

Declare a corresponding storage block in shaders that need it:

```glsl
layout(set=0, binding=1, std430) buffer PrivateMemory { uint words[]; } memory;
```

For multi-pass work:

```json
"computeSequence": {
  "begin": "begin.comp.spv",
  "after": "after.comp.spv",
  "repeat": 8
}
```

Each frame runs `begin` once, then repeats `compute` → `after` between 1 and 512
times before rendering. Each dispatch is one workgroup. The runtime inserts
compute memory barriers between passes. Count frame time and input edges once
in `begin`, not in every repeated pass. Keep workloads bounded: expensive or
nonterminating shaders can stall the display or session.

## Testing and troubleshooting

Rebuild the launcher and example, run package/runtime tests, and execute menu
compute fixtures on desktop Vulkan:

```sh
bash homebrew-launcher/build-launcher.sh --check
node apps/hello-world/check.cjs
```

The second command exercises idle input, B/Minus exit, held buttons, and a
controller-disconnected case; it renders the actual app shaders to a temporary
PNG. After copying the example, adapt `check.cjs` to your app's controls and
expected behavior. Desktop tests do not replace console tests.

To rebuild the desktop helper executables explicitly:

```sh
REBUILD_CHECKS=1 bash scripts/build-checks.sh
```

GitHub Actions builds shaders and runs desktop tests. It cannot validate USB
keyboard delivery or console execution.

| Problem | Check |
| --- | --- |
| No Pico connection | Host IP, pairing key, Wi-Fi settings, port 39381, and GP0/GP1 jumpers |
| Pico types but console never connects | Direct-mode focus, saved NS2 program, keyboard language, port 39380, supported versions |
| App missing | `catalog.rejected`, duplicate IDs, missing assets, validator/Pillow installation |
| App changed error | Return to menu, finish the build, tap Refresh, relaunch |
| Black app screen | Fragment output, fade opacity, atlas offsets, shader validation, desktop preview |
| No return to menu | Keep `reserved.z` nonzero; allow a batch to finish; check connected-controller input |
| Native verification failure | Restart console; verify versions; do not bypass byte checks |
| Slow initial launch | Music/data uploads and pipeline compilation occur before interactive execution |
| Many rebuilds exhaust session resources | Restart the session; pipelines are retained and cached, with a 64-version limit |

Session logs and captures live in `runs/launcher-*`. They contain local addresses,
connection tokens, and memory captures; do not include the directory in app
packages or public bug reports. Share selected error messages after reviewing
what they contain. The bridge verifies known instruction ranges before use;
full SDK dumps and old sessions are not runtime dependencies.

## Project layout

```text
sdk/                   Documented app API, build tools, native adapters and tests
apps/hello-world/       Complete example app and compiled assets
homebrew-launcher/     Menu, app runtime, renderer, audio and desktop tests
smilebasic/            BASIC bootstrap and native host bridge
  engine/              Connection, call frames and version checks
  pico-keyboard/       Pico firmware scripts, installer and HID library
  reference/           Small version-specific SDK verification records
scripts/               Tool discovery and desktop helper builds
start.sh               Host entry point
```

The repository includes application source and generated runtime assets.
Development tool installations, credentials, session output, and compiled
desktop test helpers are excluded.

## Credits

The SmileBASIC entry path derives from [pepsipu/ns2jb](https://gitlab.com/pepsipu/ns2jb).
The Pico uses [Adafruit CircuitPython HID](https://github.com/adafruit/Adafruit_CircuitPython_HID);
its MIT notice is included beside the vendored library. CircuitPython, Node.js,
Khronos glslang/SPIRV-Tools, Vulkan, Pillow, and DejaVu provide the supporting tools.

The included menu recording is **Homebrew Channel music** by **drmr**, from
*dark waters*, provided as the `intro.pcm` and `loop.pcm` segments in
`homebrew-launcher/audio/`. Attribution does not relicense third-party music or upstream
code. No blanket project license has been assigned here; retain third-party
notices and resolve redistribution permissions before publishing a licensed
release. Nintendo, SmileBASIC, and their trademarks belong to their respective
owners; this is an independent project.
