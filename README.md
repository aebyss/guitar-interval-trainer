# Interval — Guitar Lab

A browser app for practicing guitar intervals through an audio interface. Connect the input, play the requested interval from the displayed root. Playing the root first is optional; enable **Require playing the root first** for the two-step exercise. Hold each note for about 350 ms. Correct answers advance automatically after a brief confirmation.

## Run locally

From this plugin folder:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory web/dist
```

Open http://localhost:8765 in your browser. Click **Connect guitar**, allow audio access, and select your interface. Browsers call this microphone permission even when using a guitar interface. Choose Input 1 or Input 2 if automatic channel selection picks the wrong source. Your browser may expose fewer channels than the interface has physically.

Use the instrument/Hi-Z input, a clean signal, and one note at a time. Tune to A4 = 440 Hz. The app requires the displayed octave. It does not record, upload, or monitor your guitar audio. Session counts reset on reload.

Ascending, descending, and mixed directions are supported. Notes stay at or above standard guitar low E2; low fixed roots may exclude some descending intervals. Select a higher root for those exercises. The app reports when no selected interval is playable.

## Piano mode

Open http://localhost:8765/piano.html, or use the **Piano** tab in the header. Connect a digital piano over USB, click **Connect piano**, and allow MIDI access. Web MIDI works in Chrome and Edge; Firefox needs a site permission add-on, and Safari has no MIDI support. Close DAWs or other apps holding the piano first, since some systems let only one app open a MIDI device.

Each key press is judged right away against the exact octave. Playing the root is never counted as a mistake. The on-screen keyboard shows the root, the key you played (correct or incorrect), and the answer once revealed. You can also click its keys to practice without a cable.

Keys make a sound in the browser, including on-screen clicks; velocity and the sustain pedal are respected. **Sound** chooses between the recorded Salamander Grand Piano (`web/dist/samples/piano/`, CC BY 3.0, see `credits.html`; one recording every three semitones from A0 to C8, pitch-shifted at most one semitone) and a synthesized soft tone, which is also the fallback while recordings load. Turn **Play sound for keys** off if your piano's own speakers are on. **Ear training** mode plays the root and then the interval, hides the interval name, and asks you to play the second note back; **▶ Hear interval** replays it. The root changes each round by default.

## Verification

```sh
node scripts/test.mjs
```

Synthetic pitch and exercise-state tests cover common sample rates, harmonic-rich signals, silence, noise, wrong octaves, pitch tolerance, hold duration, and progression. Real audio-interface behavior must be checked with your guitar.

## Codex plugin

The `.codex-plugin/plugin.json` and `skills/interval-practice/SKILL.md` package the app as a reusable local Codex plugin. The source package is ready; marketplace registration and installation are separate. This is a browser app, not a DAW/VST effect.

Audio input is implemented using the browser [getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), which requires HTTPS or localhost and permission from the player.
