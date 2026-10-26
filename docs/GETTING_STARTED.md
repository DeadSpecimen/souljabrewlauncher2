# First launch, from an empty setup

Maintainer: **RavensClawX**.

This guide is for **Nintendo Switch 2 system 23.0.1**, **SmileBASIC 4.4.9**,
a **Raspberry Pi Pico 2 W**, and a **Linux computer**. Match those exact versions;
“latest version” is not a compatibility check. This project does not supply
SmileBASIC or console firmware. You need an installed, working copy of the
supported SmileBASIC version. Other boards, operating systems and versions are
not certified by this release.

You do not need to compile the launcher to try the release. Its GPU shaders and
Hello World assets are included. The computer must stay running while you use it.

## 1. Gather the hardware

- Switch 2 with the supported software and more than 20 MiB free in SmileBASIC's save.
- Pico **2 W** (the wireless model), plus a USB **data** cable that fits the console.
- Two removable jumper wires to connect GP0 or GP1 to a **GND** pin when instructed.
- A Linux computer and a network that allows the Pico and console to reach it.

Use the board's GP labels/pinout, not the pin's physical position counted from a
corner. [Raspberry Pi's Pico documentation](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html)
has the official pinout. Disconnect USB before changing jumpers. Do not connect
a GPIO to a power pin for these modes.

## 2. Extract the complete project and install host tools

Extract the source release into a normal writable folder. Open a terminal in
that folder; `start.sh`, `README.md`, `smilebasic/`, `sdk/` and `apps/` should be
visible. All commands below run from that folder.

Install Node.js 22 or newer using [Node's official instructions](https://nodejs.org/en/download).
On Ubuntu/Debian, install the remaining runtime tools:

```sh
sudo apt-get update
sudo apt-get install python3 python3-pil fonts-dejavu-core spirv-tools
node scripts/doctor.cjs --host-only
```

Every line should say `OK`. The checker does not install software or change the
console. Building apps adds `glslang-tools`; desktop GPU testing also needs a C
compiler, `libvulkan-dev` and a Vulkan driver. The release runs on the console
GPU, so a gaming GPU in the computer is not required.

Find the computer's LAN IPv4 address in its network settings, or run:

```sh
hostname -I
```

Choose the address on the network shared with the console/Pico. Do not use
`127.0.0.1`, a VPN-only address, or the console's own address. The examples use
`192.168.1.10`; replace it with yours everywhere. A DHCP reservation for the
computer avoids having to update the Pico when the address changes.

## 3. Install CircuitPython on the Pico

1. Download CircuitPython specifically for the [Raspberry Pi Pico 2 W](https://circuitpython.org/board/raspberry_pi_pico2_w/).
   CircuitPython 10.3.1 was used for the tested setup.
2. With the Pico unplugged, hold **BOOTSEL** while connecting it to the computer.
3. Copy the downloaded `.uf2` file to the bootloader drive.
4. Wait for it to reboot. A drive called **CIRCUITPY** should appear.
5. Find that drive's actual mount path in your file manager. On many Linux
   desktops it looks like `/media/your-user/CIRCUITPY`.

Run the installer, substituting the drive path and computer address:

```sh
bash smilebasic/pico-keyboard/install.sh /media/your-user/CIRCUITPY 192.168.1.10
```

Enter Wi-Fi credentials when prompted. The installer writes the Python code,
HID dependency, bootstrap text and settings onto the board. It creates a local
pairing key in `smilebasic/pico-keyboard/secret`; keep that file with your local
project. Neither the key nor Pico `settings.toml` belongs in a public repository.

Unplug after the installer finishes. The next normal boot exposes a keyboard,
so the CIRCUITPY drive will disappear by design.

## 4. Type and save the SmileBASIC bootstrap once

1. Set the console's USB keyboard language to **English (US)**.
2. Open SmileBASIC and focus an **empty EDIT0 program editor**.
3. With the Pico unplugged, connect **GP1 to GND**. Leave GP0 ungrounded.
4. Connect the Pico to the console. It waits about 15 seconds, then types the
   included `program.bas`. Allow roughly eight minutes; do not type or change
   focus while it is entering the program.
5. Save slot 0 as **NS2**. The saved source must match
   [bootstrap.bas](../smilebasic/bootstrap.bas).
6. Disconnect the Pico and remove the GP1 jumper.

You only need this long typing step when creating or replacing the saved
bootstrap. The normal launch is much shorter. You can enter the source manually
with a keyboard instead, but preserve punctuation, line breaks and character case.

## 5. Start a fresh session

1. Close and reopen SmileBASIC so it is a fresh application process, then open
   **Direct mode**. Do not resume a previously failed native session.
2. On the computer run:

   ```sh
   ./start.sh 192.168.1.10
   ```

   The preflight checker validates dependencies and the pairing key. The host
   prints `Graphics listener ready` and a new session folder.
3. Connect the Pico to the console with **neither GP0 nor GP1 grounded**.
4. Leave Direct mode focused. The board loads NS2, runs it, issues `REMOVE`,
   then types the connection command supplied by this host session. The expected
   `Out of memory` response to `REMOVE` is part of the bootstrap sequence.
5. Wait for the host to finish checks, upload graphics/audio and show HBLauncher.
   A successful startup reports a continuous native frame loop.

**Never repeat `REMOVE` in the same SmileBASIC process.** After a failed attempt,
close/restart SmileBASIC before retrying. Reuse the saved NS2 program, not an old
session's connection command or addresses.

The host accepts inbound TCP **39380** (console) and **39381** (Pico). Allow them
on your local network if a firewall blocks them. Guest-network/client isolation
can block connections even when all devices have Wi-Fi. Do not forward these
ports to the public internet. The internal authenticated RPC connection is on
loopback only.

## 6. Use the launcher

- D-pad **Up/Down** or the left stick selects an app; **A** opens it.
- Touch an app row to launch it. Touch Refresh to rescan `apps/`.
- Touch the speaker to toggle menu music.
- Put either detached Joy-Con 2 into optical mouse position to move the cursor.
  **L** clicks while the left Joy-Con tracks; **R** clicks while the right tracks.
  These clicks work on app rows, the speaker and Refresh. **ZR** is also a click.
- The cursor hides when neither optical sensor reports active tracking.
- Hello World returns to the launcher with **B** or **Minus**.
- D-pad Left/Right do not enable any debug catalog or preview mode.

Normal cursor movement stays on-console and does not wait for host polling.
App switches and explicit SDK service requests stop at a controlled boundary.
The launcher has no System/diagnostics menu.

## 7. Stop, update or repair

Press Ctrl+C in the host terminal. The worker exits at a cycle boundary and
owned hardware services are closed. Restart SmileBASIC to release retained
native allocations before a new session.

To edit files on the Pico, unplug it, connect **GP0 to GND**, and reconnect it to
the computer. CIRCUITPY returns in maintenance mode. Update settings or rerun the
installer, unplug, remove the jumper, and reconnect normally. **BOOTSEL** is only
needed when installing/replacing the UF2 firmware.

| Symptom | Check |
| --- | --- |
| No CIRCUITPY drive after installation | Use GP0-to-GND maintenance mode; check that the cable carries data |
| Pico types into the wrong screen | Disconnect it; choose the correct editor/Direct mode before reconnecting |
| Bootstrap punctuation is wrong | Set USB keyboard layout to English (US), then re-enter the source |
| Host never sees the Pico | Check its Wi-Fi credentials, computer IP, pairing key and TCP 39381 |
| Pico connects but console does not | Check TCP 39380 and console network isolation |
| Missing module/font/tool message | Run `node scripts/doctor.cjs` and fix each `NEED` line |
| App not listed | Check `app.json`, return to menu, then Refresh; inspect `catalog.rejected` in the private session report |
| Mouse cursor is hidden | Detach a Joy-Con, place its optical side on a suitable surface, and move it; generic mouse support is separate |
| Native session or version check fails | Restart SmileBASIC; verify exact supported versions; do not bypass qualification |

See [the full README](../README.md) for package installation and troubleshooting,
[the Pico reference](../smilebasic/pico-keyboard/README.md) for modes and protocol,
and [the SDK guide](../sdk/README.md) to build your own apps.
