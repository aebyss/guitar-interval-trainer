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

## Verification

```sh
node scripts/test.mjs
```

Synthetic pitch and exercise-state tests cover common sample rates, harmonic-rich signals, silence, noise, wrong octaves, pitch tolerance, hold duration, and progression. Real audio-interface behavior must be checked with your guitar.

## Codex plugin

The `.codex-plugin/plugin.json` and `skills/interval-practice/SKILL.md` package the app as a reusable local Codex plugin. The source package is ready; marketplace registration and installation are separate. This is a browser app, not a DAW/VST effect.

Audio input is implemented using the browser [getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), which requires HTTPS or localhost and permission from the player.
