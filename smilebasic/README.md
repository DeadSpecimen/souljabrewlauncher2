# SmileBASIC bridge

The supported target is SmileBASIC **4.4.9** on Switch 2 **23.0.1**. Runtime
qualification checks native instruction ranges before using version-specific
addresses. A newer version is not automatically supported.

[Getting Started](../docs/GETTING_STARTED.md) covers first-time installation,
bootstrap entry, network setup and normal launches. Save `bootstrap.bas` as NS2
in slot 0. The Pico's normal keyboard sequence loads that source, runs it,
performs the one-shot `REMOVE` transition and types the fresh host connection.
Do not repeat that transition inside the same application process.

`host.cjs` establishes and qualifies the native session, then exposes a tokened
loopback RPC interface for renderer/SDK tools. `connection.cjs` coordinates the
console listener and Pico keyboard handshake. `engine/` contains packet,
call-frame and qualification machinery; `reference/` contains small verification
records. Full SDK dumps are neither distributed nor required at runtime.

The host saves private session files under ignored `runs/`. These may contain
memory captures, IP addresses and tokens. The release package includes source
and required generated assets, not those session records. See the SDK's
[native reference](../sdk/docs/native.md) for qualified calls and worker lifetime.

This project retains attribution to the upstream
[pepsipu/ns2jb](https://gitlab.com/pepsipu/ns2jb) entry path. The application runtime,
SDK and launcher operate inside that established process; they do not promise
an arbitrary CPU application loader or universal console service access.
