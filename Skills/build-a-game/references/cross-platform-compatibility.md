# Cross-Platform Compatibility (P2, conditional)

Use only for platforms named in the approved requirements or when evaluating a requested target. Source portability is not proof of a working build. Inspect the actual engine version, exporters, plugins, APIs, and support policy first.

## Compatibility matrix

Record each target (browser/runtime or OS/device class), engine/build version, status, input, display/aspect ratio, storage/lifecycle, network/permissions, performance target, and checks/evidence. Mark untested targets `NOT RUN`; don't use “supported” without a built and run artifact on that target.

Validate where relevant:
- build/export and startup on the target;
- keyboard/mouse/gamepad/touch mapping and focus/pause behavior;
- supported resolution/aspect ratios, safe areas, UI scaling, text readability, fullscreen/window behavior;
- resource path/case sensitivity, memory/storage limits, save location and migration;
- lifecycle/background/resume, suspend/recovery, audio unlock/routing, permissions/network;
- representative frame time, memory, loading, thermal/battery constraints on real target hardware.

Use engine-native emulators/simulators as early checks, not replacements for physical device testing where hardware behavior matters. Report device/OS/runtime/build and evidence. Do not expand targets, create store accounts, buy devices/services, or promise compatibility without user authorization and verification.