---
name: interval-practice
description: Open or customize the bundled guitar interval practice web app, which checks live audio-interface notes against a root and requested interval and advances after success.
---

The app source is at `../../web/dist/` relative to this skill. It uses browser audio input for single-note guitar pitch detection, with an optional root-first exercise and automatic progression. It is not an audio-unit or VST plugin.

To open locally, serve that directory on localhost using Python's HTTP server and open the reported local URL. For hosting on a Raspberry Pi or another static host, serve `web/dist` over HTTPS so a desktop browser can access the audio interface. Audio processing runs on the browser device, not the server.

The player must choose their interface in the input selector and grant browser microphone access. Input 1, Input 2, and automatic strongest-channel detection are available; actual exposed channels depend on browser and interface routing. Use clean single notes and mute other strings. The app intentionally does not monitor input to the speakers or upload audio.

When editing the detector or exercise flow, preserve octave-sensitive scoring, a stable hold, release between root and target when root-first mode is enabled, and single-count completion. Run `../../scripts/test.mjs` with Node after such changes. Synthetic tests are not evidence of successful testing with a real guitar or interface.
