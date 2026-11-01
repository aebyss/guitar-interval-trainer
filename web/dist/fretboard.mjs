import {noteName} from './pitch.mjs';
// High E at the top, as in a conventional guitar tablature diagram.
export const tuning = [64,59,55,50,45,40];
export function matchingPositions(midi,min=0,max=24){
  if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max>24||min>max)throw new RangeError('Use a fret range from 0 to 24.');
  if(!Number.isInteger(midi))return [];
  return tuning.flatMap((open,i)=>{const fret=midi-open;return fret>=min&&fret<=max?[{string:i+1,fret}]:[];});
}
export function createFretboard(document){
  const get=id=>document.getElementById(id),board=get('fretboard-grid');
  let min=1,max=15,current=null,root=null,correct=false,lastKey='';
  const cells=[];
  for(const id of ['fret-min','fret-max'])for(let fret=0;fret<=24;fret++)get(id).add(new Option(fret===0?'0 (open)':String(fret),String(fret)));
  get('fret-min').value='1';get('fret-max').value='15';
  function build(){
    cells.length=0;board.replaceChildren();board.style.setProperty('--frets',max-min+1);
    const header=document.createElement('tr');header.append(document.createElement('th'));
    for(let fret=min;fret<=max;fret++){const th=document.createElement('th');th.scope='col';th.textContent=String(fret);th.title=fret===0?'Open string':'Fret '+fret;header.append(th);}board.append(header);
    tuning.forEach((open,i)=>{const row=document.createElement('tr'),label=document.createElement('th');label.scope='row';label.textContent=noteName(open);label.title='String '+(i+1);row.append(label);
      for(let fret=min;fret<=max;fret++){const cell=document.createElement('td'),dot=document.createElement('span');cell.className='fret-cell'+(fret===0?' open-string':'');cell.title='String '+(i+1)+', '+(fret?'fret '+fret:'open')+': '+noteName(open+fret);dot.className='fret-note';cell.append(dot);if(([3,5,7,9,15].includes(fret)&&i===2)||(fret===12&&(i===1||i===3))){const marker=document.createElement('span');marker.className='fret-inlay';cell.append(marker);}row.append(cell);cells.push({cell,dot,midi:open+fret});}board.append(row);
    });lastKey='';paint();
  }
  function paint(){
    const key=[current,root,correct,min,max].join(':');if(key===lastKey)return;lastKey=key;
    for(const {cell,dot,midi} of cells){const played=midi===current,isRoot=midi===root;cell.classList.toggle('is-root',isRoot);cell.classList.toggle('is-played',played);cell.classList.toggle('is-correct',played&&correct);dot.textContent=played||isRoot?noteName(midi):'';}
    const positions=matchingPositions(current,min,max);
    get('fretboard-status').textContent=current===null?'Play a single note to see its positions.':positions.length?noteName(current)+' · '+positions.length+' matching position'+(positions.length===1?'':'s')+(correct?' · Correct pitch':''):noteName(current)+' · No matching positions in frets '+min+'–'+max+'.';
  }
  function changeRange(event){
    const filtered=get('fret-filter').checked;get('fret-min').disabled=get('fret-max').disabled=!filtered;
    let lo=Number(get('fret-min').value),hi=Number(get('fret-max').value);
    if(lo>hi){if(event?.target===get('fret-min')){hi=lo;get('fret-max').value=String(hi);}else{lo=hi;get('fret-min').value=String(lo);}}
    min=filtered?lo:1;max=filtered?hi:15;build();
  }
  for(const id of ['fret-filter','fret-min','fret-max'])get(id).addEventListener('change',changeRange);
  changeRange();
  return {update(midi,rootMidi,isCorrect=false){current=Number.isInteger(midi)?midi:null;root=rootMidi;correct=isCorrect;paint();}};
}
