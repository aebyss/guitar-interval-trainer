// YIN-style cumulative mean normalized difference; no audio leaves the device.
export function detectPitch(buffer, sampleRate, gate = 0.006) {
  let mean=0,energy=0,peak=0;
  for(const x of buffer){mean+=x;peak=Math.max(peak,Math.abs(x));} mean/=buffer.length;
  for(const x of buffer)energy+=(x-mean)**2;
  const rms=Math.sqrt(energy/buffer.length);
  if(rms<gate)return {frequency:null,rms,peak};
  // Retain ~24kHz for accurate interpolation on high guitar notes.
  const stride=Math.max(1,Math.floor(sampleRate/24000)), rate=sampleRate/stride;
  const n=Math.floor(buffer.length/stride), data=new Float32Array(n);
  for(let i=0;i<n;i++){let v=0;for(let j=0;j<stride;j++)v+=buffer[i*stride+j]-mean;data[i]=v/stride;}
  const maxLag=Math.min(Math.floor(rate/70),Math.floor(n/2)),window=n-maxLag;
  const diff=new Float32Array(maxLag+1);let total=0;diff[0]=1;
  for(let lag=1;lag<=maxLag;lag++){let sum=0;for(let j=0;j<window;j++){const d=data[j]-data[j+lag];sum+=d*d;}total+=sum;diff[lag]=total?sum*lag/total:1;}
  for(let lag=Math.max(2,Math.floor(rate/1400));lag<maxLag-1;lag++){
    if(diff[lag]<0.13){while(lag+1<maxLag&&diff[lag+1]<diff[lag])lag++;
      if(lag>=maxLag)return {frequency:null,rms,peak};
      const a=diff[lag-1],b=diff[lag],c=diff[lag+1],den=2*(2*b-a-c);
      const offset=den?(c-a)/den:0, frequency=rate/(lag+Math.max(-1,Math.min(1,offset)));
      return {frequency:frequency>=70&&frequency<=1400?frequency:null,rms,peak,confidence:1-b};
    }
  }
  return {frequency:null,rms,peak};
}
export const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const noteName=midi=>names[((midi%12)+12)%12]+(Math.floor(midi/12)-1);
export const noteFrequency=midi=>440*2**((midi-69)/12);
export const pitchMidi=frequency=>69+12*Math.log2(frequency/440);
export const intervals=[['m2','Minor second'],['M2','Major second'],['m3','Minor third'],['M3','Major third'],['P4','Perfect fourth'],['TT','Tritone'],['P5','Perfect fifth'],['m6','Minor sixth'],['M6','Major sixth'],['m7','Minor seventh'],['M7','Major seventh'],['P8','Octave']];
// Standard guitar: low E2 to E6, random roots E2–C4.
export const guitarRange={low:40,high:88,roots:Array.from({length:21},(_,i)=>40+i)};
export function makeChallenge(rootChoice,direction,enabled,previous=null,random=Math.random,range=guitarRange){
  const candidates=[];
  for(const gap of enabled)for(const sign of direction==='mixed'?[1,-1]:[direction==='down'?-1:1]){
    const roots=rootChoice==='random'?range.roots:[Number(rootChoice)];
    for(const root of roots){const target=root+gap*sign;if(target>=range.low&&target<=range.high)candidates.push({root,target,gap,sign});}
  }
  if(!candidates.length)return null;
  const different=candidates.filter(c=>!previous||c.root!==previous.root||c.target!==previous.target);
  const pool=different.length?different:candidates;return pool[Math.floor(random()*pool.length)];
}
export class PracticeEngine{
  constructor(challenge,{requireRoot=false}={}){this.requireRoot=requireRoot;this.reset(challenge);}
  reset(challenge){this.challenge=challenge;this.stage=this.requireRoot?'root':'target';this.since=null;this.lastTime=null;this.lastMatch=null;this.releaseSince=null;this.progress=0;}
  feed(frequency,time,tolerance=35){
    if(this.stage==='complete'||!this.challenge)return null;
    if(this.lastTime!==null&&time-this.lastTime>180){this.since=null;this.lastMatch=null;this.releaseSince=null;}
    this.lastTime=time;
    if(this.stage==='release'){
      const rootCents=frequency?Math.abs((pitchMidi(frequency)-this.challenge.root)*100):Infinity;
      if(rootCents>65){if(this.releaseSince===null)this.releaseSince=time;if(time-this.releaseSince>=140){this.stage='target';this.since=null;return 'target';}}
      else this.releaseSince=null;
      return null;
    }
    const expected=this.stage==='root'?this.challenge.root:this.challenge.target;
    const match=frequency&&Math.abs((pitchMidi(frequency)-expected)*100)<=tolerance;
    if(!match){
      // Brief unpitched frames occur naturally at guitar attacks and during decay.
      // They pause a hold; a different pitched note or sustained silence resets it.
      if(frequency||this.lastMatch===null||time-this.lastMatch>100){this.since=null;this.lastMatch=null;this.progress=0;}
      return null;
    }
    if(this.lastMatch!==null&&this.since!==null&&time-this.lastMatch>75)this.since+=time-this.lastMatch;
    this.lastMatch=time;
    if(this.since===null)this.since=time;
    this.progress=Math.min(1,(time-this.since)/350);
    if(this.progress>=1){this.progress=0;this.since=null;if(this.stage==='root'){this.stage='release';return 'root';}this.stage='complete';return 'correct';}
    return null;
  }
}
