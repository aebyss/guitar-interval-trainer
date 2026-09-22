import assert from 'node:assert/strict';
import {detectPitch,noteFrequency,PracticeEngine,makeChallenge} from '../web/dist/pitch.mjs';
let cases=0;
for(const rate of [44100,48000,96000])for(const midi of [40,45,52,57,64,76,88])for(const cents of [-25,0,25]){
  const frequency=noteFrequency(midi)*2**(cents/1200);
  const samples=Float32Array.from({length:4096},(_,i)=>{const phase=2*Math.PI*frequency*i/rate;return .15*Math.sin(phase)+.22*Math.sin(phase*2)+.06*Math.sin(phase*3)+.012;});
  const actual=detectPitch(samples,rate).frequency;assert.ok(actual,`No pitch for ${midi}`);assert.ok(Math.abs(1200*Math.log2(actual/frequency))<12,`Pitch ${midi} at ${rate}: ${actual} vs ${frequency}`);cases++;
}
assert.equal(detectPitch(new Float32Array(4096),48000).frequency,null);
let seed=17;const noise=Float32Array.from({length:4096},()=>{seed=(seed*1664525+1013904223)>>>0;return (seed/4294967296-.5)*.1;});assert.equal(detectPitch(noise,48000).frequency,null);
const c={root:45,target:49,gap:4,sign:1},e=new PracticeEngine(c,{requireRoot:true});
for(let t=0;t<=500;t+=50)e.feed(noteFrequency(49),t);assert.equal(e.stage,'root','Target cannot bypass root');
for(let t=550;t<=1000;t+=50)e.feed(noteFrequency(45),t);assert.equal(e.stage,'release');
for(let t=1050;t<=1500;t+=50)e.feed(noteFrequency(45),t);assert.equal(e.stage,'release','Sustained root must not advance');
for(let t=1550;t<=1750;t+=50)e.feed(null,t);assert.equal(e.stage,'target');
for(let t=1800;t<=2300;t+=50)e.feed(noteFrequency(61),t);assert.equal(e.stage,'target','Wrong octave must fail');
for(let t=2350;t<=2800;t+=50)e.feed(noteFrequency(49)*2**(40/1200),t,35);assert.equal(e.stage,'target','Outside tolerance must fail');
let successes=0;for(let t=2850;t<=3500;t+=50)if(e.feed(noteFrequency(49),t)==='correct')successes++;assert.equal(e.stage,'complete');assert.equal(successes,1);
e.reset(c);e.feed(noteFrequency(45),0);e.feed(noteFrequency(45),1000);assert.equal(e.stage,'root','Background time must not satisfy hold');
assert.equal(makeChallenge('45','down',[12]),null);
for(let i=0;i<100;i++){const q=makeChallenge('random','mixed',[1,3,4,7,12]);assert.ok(q.root>=40&&q.target>=40&&q.target<=88);assert.equal(Math.abs(q.target-q.root),q.gap);}
console.log(`Passed ${cases} pitch cases, silence/noise rejection, root/target order, octave/tolerance checks, single success, hold continuity, and guitar range.`);

const direct=new PracticeEngine(c);
assert.equal(direct.stage,'target');
for(let t=0;t<=500;t+=50)direct.feed(noteFrequency(45),t);
assert.equal(direct.stage,'target','Root alone cannot satisfy the answer');
let directCount=0;
for(let t=550;t<=1100;t+=50)if(direct.feed(noteFrequency(49),t)==='correct')directCount++;
assert.equal(directCount,1,'Correct answer without playing root must succeed once');
direct.reset(c);
for(let t=0;t<=500;t+=50)direct.feed(t===200?null:noteFrequency(49),t);
assert.equal(direct.stage,'complete','One unpitched frame must not block a held answer');
direct.reset(c);
for(let t=0;t<=250;t+=50)direct.feed(noteFrequency(49),t);
direct.feed(noteFrequency(50),300);direct.feed(noteFrequency(49),350);
assert.equal(direct.progress,0,'Wrong notes reset the hold');
direct.reset(c);
for(let t=0;t<=250;t+=50)direct.feed(noteFrequency(49),t);
for(let t=300;t<=500;t+=50)direct.feed(null,t);
direct.feed(noteFrequency(49),550);assert.equal(direct.progress,0,'Long dropouts reset the hold');
console.log('Passed direct-answer and brief-dropout regressions.');
