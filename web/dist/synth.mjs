import {noteFrequency} from './pitch.mjs';
// Recorded grand piano with a small additive fallback voice: slightly stretched partials, fast attack, pitch-dependent decay.
// 100% volume drives the master at 3.5×; the limiter holds peaks just under full scale, so higher volume mostly lifts the sustain.
const gainScale=3.5;
// Linear below 0.8, then a tanh knee that never exceeds full scale, so limiter overshoot rounds off instead of clipping.
const softClip=Float32Array.from({length:2049},(_,i)=>{const x=i/1024-1,m=Math.abs(x);return Math.sign(x)*(m<=.8?m:.8+.2*Math.tanh((m-.8)/.2));});
const partials=[[1,1],[2,.42],[3,.2],[4,.11],[5,.06],[6,.03]];
// Salamander Grand Piano recordings every minor third from A0 to C8 (credits in samples/piano/credits.html).
const sampleNames=['C','Cs','D','Ds','E','F','Fs','G','Gs','A','As','B'];
export const pianoSampleNotes=Array.from({length:30},(_,i)=>21+i*3);
export const sampleName=midi=>sampleNames[midi%12]+(Math.floor(midi/12)-1);
// Nearest recording, so playback is pitch-shifted by at most one semitone.
export function nearestSample(midi){const sample=Math.max(21,Math.min(108,Math.round((midi-21)/3)*3+21));return {midi:sample,rate:2**((midi-sample)/12)};}
// The recordings are much quieter than the synth voice; this matches their loudness at mid-range notes.
const sampleGain=4;
export class PianoSynth{
  constructor(){this.context=null;this.voices=new Map();this.sustained=new Set();this.pedal=false;this.volume=.7;this.sound='piano';this.buffers=new Map();this.loading=null;this.onload=null;}
  // Browsers only start audio after a user gesture, so call this from click/keydown handlers.
  unlock(){
    if(!this.context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;this.context=new Audio();
      this.master=this.context.createGain();this.master.gain.value=this.volume*gainScale;const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-1.5;limiter.knee.value=2;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.12;const clip=this.context.createWaveShaper();clip.curve=softClip;clip.oversample='4x';this.master.connect(limiter).connect(clip).connect(this.context.destination);}
    if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
    if(this.sound==='piano')this.loadSamples();return true;
  }
  // Loads all recordings in the background; notes use the synthesized tone until theirs arrives.
  loadSamples(){
    if(this.loading||!this.context)return this.loading;
    let failed=0;
    this.loading=Promise.all(pianoSampleNotes.map(async midi=>{
      try{const response=await fetch(new URL('./samples/piano/'+sampleName(midi)+'.mp3',import.meta.url));if(!response.ok)throw new Error(response.status);this.buffers.set(midi,await this.context.decodeAudioData(await response.arrayBuffer()));}
      catch{failed++;}
    })).then(()=>{this.onload?.(failed);if(failed===pianoSampleNotes.length)this.loading=null;return failed;});
    return this.loading;
  }
  setSound(sound){this.sound=sound;if(sound==='piano')this.loadSamples();}
  get ready(){return this.context?.state==='running';}
  setVolume(volume){this.volume=volume;if(this.master)this.master.gain.setTargetAtTime(volume*gainScale,this.context.currentTime,.02);}
  noteOn(midi,velocity=90,when=0){
    if(!this.context)return;this.noteOff(midi,true,when);
    const sample=nearestSample(midi),buffer=this.sound==='piano'&&this.buffers.get(sample.midi);
    if(buffer)return this.sampleOn(midi,velocity,Math.max(this.context.currentTime,when||0),buffer,sample.rate);
    const ctx=this.context,t=Math.max(ctx.currentTime,when||0),f=noteFrequency(midi),v=(velocity/127)**1.1;
    const decay=Math.max(.8,4.5-(midi-40)*.05),out=ctx.createGain(),tone=ctx.createBiquadFilter();
    tone.type='lowpass';tone.frequency.value=Math.min(16000,f*(4+10*v));tone.Q.value=.3;
    out.gain.setValueAtTime(0,t);out.gain.linearRampToValueAtTime(.4*v+.08,t+.006);out.gain.setTargetAtTime(.24*v+.05,t+.006,.15);out.gain.setTargetAtTime(0,t+.25,decay/3);
    tone.connect(out).connect(this.master);
    const oscillators=partials.filter(([n])=>f*n<ctx.sampleRate/2.2).map(([n,amp])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=f*n*(1+.0004*n*n);g.gain.setValueAtTime(amp,t);g.gain.setTargetAtTime(0,t,decay/(n*1.3));o.connect(g).connect(tone);o.start(t);o.stop(t+decay*2.5);return o;});
    this.track(midi,out,oscillators);
  }
  // Softer playing is quieter and darker, like a real hammer.
  sampleOn(midi,velocity,t,buffer,rate){
    const ctx=this.context,v=velocity/127,source=ctx.createBufferSource(),tone=ctx.createBiquadFilter(),out=ctx.createGain();
    source.buffer=buffer;source.playbackRate.value=rate;tone.type='lowpass';tone.frequency.value=1200+18000*v*v;tone.Q.value=.2;
    out.gain.setValueAtTime(sampleGain*(.08+.92*v**1.5),t);source.connect(tone).connect(out).connect(this.master);source.start(t);
    this.track(midi,out,[source]);
  }
  track(midi,out,sources){const voice={out,sources};sources[0].onended=()=>{if(this.voices.get(midi)===voice)this.voices.delete(midi);out.disconnect();};this.voices.set(midi,voice);}
  // Releases damp quickly unless the sustain pedal holds them.
  noteOff(midi,force=false,when=0){
    const voice=this.voices.get(midi);if(!voice)return;
    if(this.pedal&&!force){this.sustained.add(midi);return;}
    const t=Math.max(this.context.currentTime,when||0);voice.out.gain.cancelScheduledValues(t);voice.out.gain.setTargetAtTime(0,t,.07);voice.sources.forEach(o=>{try{o.stop(t+.5);}catch{}});
    this.voices.delete(midi);this.sustained.delete(midi);
  }
  setPedal(down){this.pedal=down;if(!down){for(const midi of [...this.sustained])this.noteOff(midi);this.sustained.clear();}}
  // Plays root then target melodically; returns seconds until it finishes.
  playInterval(root,target,gap=.75){
    if(!this.unlock())return 0;const t=this.context.currentTime+.05;
    this.noteOn(root,85,t);this.noteOff(root,true,t+gap-.05);this.noteOn(target,85,t+gap);this.noteOff(target,true,t+gap*2.2);return gap*2.2+.05;
  }
  allOff(){this.pedal=false;this.sustained.clear();for(const midi of [...this.voices.keys()])this.noteOff(midi,true);}
}
