import {intervals,noteName} from './pitch.mjs';
// 88-key piano: A0 to C8, random roots C3–C5.
export const pianoRange={low:21,high:108,roots:Array.from({length:25},(_,i)=>48+i)};
export const isBlack=midi=>[1,3,6,8,10].includes(((midi%12)+12)%12);
// Describes any played note relative to the root, including compound intervals.
export function describeInterval(root,note){
  const gap=Math.abs(note-root);if(!gap)return 'the root';
  const octaves=Math.floor((gap-1)/12),name=intervals[(gap-1)%12][1].toLowerCase();
  const label=gap%12===0?(gap===12?'octave':gap/12+' octaves'):octaves?name+' + '+octaves+' octave'+(octaves>1?'s':''):name;
  return label+' '+(note>root?'above':'below')+' '+noteName(root);
}
// Three octaves starting one octave below the root's C, so root ±12 is always visible.
export function keyboardWindow(root){const low=12*(Math.floor(root/12)-1);return {low:Math.max(21,low),high:Math.min(108,low+36)};}
// Parses a raw MIDI message into a note or sustain-pedal event; note-on with velocity 0 is a release.
export function parseMidi([status,note,velocity=0]){
  const type=status&0xf0;
  if(type===0x90&&velocity>0)return {type:'on',note,velocity};
  if(type===0x80||type===0x90)return {type:'off',note};
  if(type===0xb0&&note===64)return {type:'pedal',down:velocity>=64};
  return null;
}
export class PianoEngine{
  constructor(challenge,{requireRoot=false}={}){this.requireRoot=requireRoot;this.reset(challenge);}
  reset(challenge){this.challenge=challenge;this.stage=challenge?(this.requireRoot?'root':'target'):'idle';}
  // Each key press is judged immediately: no hold or tuning needed on a keyboard.
  press(note){
    if(!this.challenge||this.stage==='complete'||this.stage==='idle')return 'ignored';
    const {root,target}=this.challenge;
    if(this.stage==='root'){if(note===root){this.stage='target';return 'root';}return 'wrong-root';}
    if(note===target){this.stage='complete';return 'correct';}
    if(note===root)return 'reference';
    return note%12===target%12?'octave':'wrong';
  }
}
