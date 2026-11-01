import {noteFrequency} from './pitch.mjs';
export const pianoSamples=new Map(['Ds2','Fs2','A2','C3','Ds3','Fs3','A3','C4','Ds4','Fs4','A4','C5','Ds5','Fs5','A5','C6','Ds6','Fs6'].map((name,i)=>[39+i*3,name]));
export function pianoSampleFor(midi){
  if(!Number.isFinite(midi)||midi<40||midi>88)throw new RangeError('Piano note outside guitar range');
  const sampleMidi=Math.round((midi-39)/3)*3+39;
  return {midi:sampleMidi,name:pianoSamples.get(sampleMidi),rate:2**((midi-sampleMidi)/12)};
}
const caches=new WeakMap();
export async function loadPianoPair(context,root,target,fetcher=fetch){
  if(!caches.has(context))caches.set(context,new Map());
  const cache=caches.get(context);
  const result=new Map();
  await Promise.all([root,target].map(async note=>{
    const sample=pianoSampleFor(note);
    if(!cache.has(sample.midi)){
      const pending=(async()=>{
        const response=await fetcher(new URL('./samples/piano/'+sample.name+'.mp3?v=20260929',import.meta.url),{signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error('Piano sample could not be loaded');
        return context.decodeAudioData(await response.arrayBuffer());
      })();cache.set(sample.midi,pending);pending.catch(()=>{if(cache.get(sample.midi)===pending)cache.delete(sample.midi);});
    }
    result.set(sample.midi,await cache.get(sample.midi));
  }));return result;
}
// Recorded piano samples when supplied; the original synthesized tone remains available.
export function schedulePair(context,root,target,{buffers=null,volume=.6}={}){
  const voices=[],master=context.createGain();master.gain.setValueAtTime(Math.max(0,Math.min(1,volume)),context.currentTime);master.connect(context.destination);
  const start=context.currentTime+.05;
  for(const [midi,offset] of [[root,0],[target,.9]]){
    const voice=buffers?context.createBufferSource():context.createOscillator(),gain=context.createGain(),at=start+offset;
    if(buffers){const sample=pianoSampleFor(midi);voice.buffer=buffers.get(sample.midi);voice.playbackRate.setValueAtTime(sample.rate,at);}else{voice.type='triangle';voice.frequency.setValueAtTime(noteFrequency(midi),at);}
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(buffers ? .65 : .3,at+.008);
    gain.gain.setValueAtTime(buffers ? .65 : .3,at+.5);gain.gain.exponentialRampToValueAtTime(.001,at+.75);
    voice.connect(gain);gain.connect(master);voice.start(at);voice.stop(at+.8);
    voice.onended=()=>{voice.disconnect();gain.disconnect();if(++ended===2)master.disconnect();};voices.push(voice);
  }
  let ended=0;
  return {duration:1800,setVolume(value){master.gain.setValueAtTime(Math.max(0,Math.min(1,value)),context.currentTime);},stop(){for(const voice of voices){try{voice.stop();}catch{}}}};
}
