import {noteName,intervals,makeChallenge} from './pitch.mjs';
import {pianoRange,isBlack,describeInterval,keyboardWindow,parseMidi,PianoEngine} from './piano.mjs';
import {PianoSynth} from './synth.mjs';
const $=id=>document.getElementById(id);
let enabled=new Set([3,4,5,7,12]),challenge={root:60,target:64,gap:4,sign:1},engine=new PianoEngine(challenge);
const synth=new PianoSynth();
let midi=null,connecting=false,advanceTimer=0,missTimer=0,listenTimer=0,score=0,misses=0,revealed=false,lastPlayed=null,keyRange=null;
const held=new Set();
const intervalName=()=>intervals[challenge.gap-1][1].toLowerCase();
const ear=()=>$('mode').value==='ear',keySound=()=>$('key-sound').checked;
// In ear training the interval stays hidden until it is answered or revealed.
const ask=()=>ear()?'the second note you heard':'the '+intervalName()+' '+(challenge.sign>0?'above ':'below ')+noteName(challenge.root);
function showInterval(){$('interval-name').textContent=intervals[challenge.gap-1][1];$('direction-label').textContent='PLAY '+(challenge.sign>0?'ABOVE':'BELOW')+' THE ROOT';document.querySelector('.arrow').textContent=challenge.sign>0?'↗':'↘';$('semitones').textContent=challenge.gap+' semitone'+(challenge.gap===1?'':'s')+' '+(challenge.sign>0?'up':'down');}
function listen(){clearTimeout(listenTimer);synth.playInterval(challenge.root,challenge.target);}
function showError(message){$('error').textContent=message;$('error').hidden=!message;}
function setLive(note,message,detail,verdict=''){
  $('detected-note').textContent=note==null?'—':noteName(note);$('key-message').textContent=message;$('key-detail').textContent=detail;
  $('verdict').hidden=!verdict;$('verdict').textContent=verdict==='correct'?'✓ CORRECT':verdict==='wrong'?'✕ INCORRECT':'ROOT ✓';$('verdict').className='verdict '+verdict;
}
// Absolutely positioned keys: whites share the width evenly, blacks sit on the boundary after the preceding white.
function renderKeyboard(){
  const range=keyboardWindow(challenge.root);if(keyRange&&keyRange.low===range.low&&keyRange.high===range.high)return updateKeys();keyRange=range;
  const whites=[];for(let n=range.low;n<=range.high;n++)if(!isBlack(n))whites.push(n);
  const unit=100/whites.length,keys=[];let whiteIndex=0;
  for(let n=range.low;n<=range.high;n++){
    const key=document.createElement('button');key.type='button';key.dataset.note=n;key.tabIndex=-1;key.setAttribute('aria-label',noteName(n));
    if(isBlack(n)){key.className='key black';key.style.left=(whiteIndex*unit-unit*.31)+'%';key.style.width=unit*.62+'%';}
    else{key.className='key white';key.style.left=whiteIndex*unit+'%';key.style.width=unit+'%';whiteIndex++;}
    key.append(Object.assign(document.createElement('span'),{className:'key-label'}));keys.push(key);
  }
  $('keyboard').replaceChildren(...keys.filter(k=>k.classList.contains('white')),...keys.filter(k=>k.classList.contains('black')));updateKeys();
}
function updateKeys(){
  const complete=engine.stage==='complete';
  for(const key of $('keyboard').children){
    const n=Number(key.dataset.note),played=lastPlayed?.note===n?lastPlayed.kind:null,isRoot=n===challenge.root,isTarget=n===challenge.target&&(revealed||complete);
    key.classList.toggle('is-root',isRoot);key.classList.toggle('is-held',held.has(n));key.classList.toggle('is-correct',played==='correct');key.classList.toggle('is-wrong',played==='wrong');key.classList.toggle('is-target',isTarget&&played!=='correct');
    key.firstChild.textContent=played==='correct'?'✓':played==='wrong'?'✕':isRoot?'R':isTarget?'?':n%12===0?noteName(n):'';
  }
}
function renderChallenge(){
  const root=noteName(challenge.root);$('root-note').replaceChildren(document.createTextNode(root.slice(0,-1)),Object.assign(document.createElement('span'),{textContent:root.slice(-1)}));
  $('root-key').textContent=challenge.root===60?'Middle C':'Key '+(challenge.root-20)+' of 88';document.querySelector('.practice').classList.toggle('ear',ear());
  if(ear()){$('interval-name').textContent='Listen…';$('direction-label').textContent='EAR TRAINING';document.querySelector('.arrow').textContent='♪';$('semitones').textContent='Play back the second note';}else showInterval();
  $('answer').hidden=true;revealed=false;lastPlayed=null;
  $('step-root').className=engine.requireRoot?'step active':'step reference';$('step-root').lastChild.textContent=engine.requireRoot?' Play the root':' Root reference';$('step-target').className=engine.requireRoot?'step':'step active';
  document.querySelector('.practice').classList.remove('success','miss');
  $('feedback').textContent=(ear()?(synth.ready?'Listen: root, then the interval. ':'Press ▶ Hear interval to listen. '):'')+(midi?'':'Connect your piano, or click the keys below. ')+(engine.requireRoot?'Play '+root+' first, then '+ask()+'.':'Play '+ask()+'.'+(ear()?'':' No need to play the root first.'));
  clearTimeout(listenTimer);if(ear()&&synth.ready)listenTimer=setTimeout(listen,350);
  setLive(null,midi?'Waiting for a key…':'Your piano goes here.',midi?'Play '+(engine.requireRoot?'the root':'your answer'):'Connect your piano, or click the keys below');renderKeyboard();
}
function nextChallenge(){
  clearTimeout(advanceTimer);
  const next=makeChallenge($('root-select').value,$('direction').value,[...enabled],challenge,Math.random,pianoRange);
  if(!next){showError('No selected interval fits on the piano from this root. Choose another root or interval.');engine.reset(null);return false;}
  showError('');challenge=next;engine.reset(challenge);renderChallenge();return true;
}
function renderChips(){
  $('interval-options').replaceChildren(...intervals.map(([short,name],i)=>{const button=document.createElement('button');button.type='button';button.className='chip';button.textContent=short;button.title=name;button.setAttribute('aria-label',name);button.setAttribute('aria-pressed',String(enabled.has(i+1)));button.onclick=()=>{if(enabled.has(i+1)){if(enabled.size===1)return;enabled.delete(i+1);}else enabled.add(i+1);renderChips();nextChallenge();};return button;}));
}
function miss(note,message,detail){
  misses++;$('misses').textContent=misses;lastPlayed={note,kind:'wrong'};setLive(note,message,detail,'wrong');
  const practice=document.querySelector('.practice');practice.classList.remove('miss');void practice.offsetWidth;practice.classList.add('miss');clearTimeout(missTimer);missTimer=setTimeout(()=>practice.classList.remove('miss'),600);
}
function press(note){
  const result=engine.press(note),played=noteName(note),relation=describeInterval(challenge.root,note);
  if(result==='root'){lastPlayed=null;$('step-root').className='step done';$('step-target').className='step active';setLive(note,'Root found.','Now play '+ask()+'.','root');$('feedback').textContent='Root found. Now play '+ask()+'.';}
  if(result==='wrong-root')miss(note,'Incorrect. Play the root first.',played+' · '+relation);
  if(result==='reference'){lastPlayed=null;setLive(note,'That’s the root.','Now find '+ask()+'.');}
  if(result==='octave')miss(note,'Incorrect. Right note, wrong octave.',played+' · '+relation);
  if(result==='wrong')miss(note,'Incorrect. Try again.',played+' · '+relation);
  if(result==='correct'){
    score++;$('score').textContent=score;lastPlayed={note,kind:'correct'};$('step-target').className='step done';document.querySelector('.practice').classList.add('success');
    if(ear())showInterval();setLive(note,'Correct!',played+' · '+relation,'correct');$('feedback').textContent='Correct! '+noteName(challenge.root)+' → '+played+(ear()?', a '+intervalName()+(challenge.sign>0?' up':' down'):'')+'. Next interval coming…';advanceTimer=setTimeout(nextChallenge,ear()?1600:1100);
  }
  if(result==='ignored'&&engine.stage==='complete')$('detected-note').textContent=played;
  updateKeys();
}
function onMessage(event){
  const message=parseMidi(event.data);if(!message)return;
  pulse();if(message.type==='pedal')return sound(()=>synth.setPedal(message.down));
  // Feedback first: a sound problem must never hide the verdict.
  if(message.type==='on'){held.add(message.note);press(message.note);if(keySound())sound(()=>synth.noteOn(message.note,message.velocity));}else{held.delete(message.note);updateKeys();sound(()=>synth.noteOff(message.note));}
}
function sound(play){try{play();}catch(error){showError('Key sound failed: '+(error.message||error.name)+'. Feedback still works; reload the page to retry sound.');}}
function pulse(){const badge=$('connection');badge.classList.remove('pulse');void badge.offsetWidth;badge.classList.add('pulse');}
function refreshInputs(){
  if(!midi)return;
  const selected=$('device').value,inputs=[...midi.inputs.values()].filter(i=>i.state!=='disconnected');
  $('device').replaceChildren(new Option('All MIDI inputs',''),...inputs.map(i=>new Option(i.name||'MIDI input',i.id)));
  if(inputs.some(i=>i.id===selected))$('device').value=selected;
  for(const input of midi.inputs.values()){const use=!$('device').value||$('device').value===input.id;input.onmidimessage=use?onMessage:null;
    // Opening fails when another app or tab holds the device; the port is still listed but sends nothing.
    if(use&&input.state!=='disconnected')input.open?.().catch(()=>showError('“'+(input.name||'MIDI input')+'” is visible but could not be opened. Close other apps or browser tabs using the piano (DAWs, other copies of this page), then click Disconnect and Connect piano again.'));}
  $('connection').className='badge'+(inputs.length?' connected':'');$('connection').textContent=inputs.length?'●  LISTENING · '+inputs.length+' INPUT'+(inputs.length>1?'S':''):'●  NO MIDI INPUT';
  showError(inputs.length?'':'No MIDI input found. Connect your piano over USB and turn it on; it will appear here automatically.');
}
function disconnect(){
  if(midi){midi.onstatechange=null;for(const input of midi.inputs.values()){input.onmidimessage=null;void input.close?.().catch(()=>{});}}
  midi=null;held.clear();synth.allOff();$('connect').innerHTML='Connect piano <span>↗</span>';$('connection').className='badge';$('connection').textContent='●  MIDI OFF';
  $('device').replaceChildren(new Option('All MIDI inputs',''));showError('');renderChallenge();
}
async function connect(){
  if(midi){disconnect();return;}if(connecting)return;
  if(!navigator.requestMIDIAccess){showError('This browser does not support Web MIDI. Use Chrome or Edge on desktop. Firefox needs a site permission add-on; Safari has no MIDI support. You can still click the on-screen keys.');return;}
  synth.unlock();connecting=true;$('connect').disabled=true;$('connect').textContent='Connecting…';showError('');
  try{midi=await navigator.requestMIDIAccess({sysex:false});midi.onstatechange=refreshInputs;$('connect').innerHTML='Disconnect <span>×</span>';renderChallenge();refreshInputs();}
  catch(error){midi=null;showError(['SecurityError','NotAllowedError'].includes(error.name)?'MIDI access was denied. Allow MIDI devices in your browser’s site settings, then connect again.':'Could not open MIDI: '+(error.message||error.name));}
  finally{connecting=false;$('connect').disabled=false;if(!midi)$('connect').innerHTML='Connect piano <span>↗</span>';}
}
window.addEventListener('error',event=>showError('Something went wrong: '+event.message+'. Try a hard reload (Ctrl+Shift+R).'));
// On-screen keys work as input too, for practice without a cable.
$('keyboard').addEventListener('pointerdown',event=>{const key=event.target.closest('.key');if(!key)return;event.preventDefault();const n=Number(key.dataset.note);held.add(n);if(keySound()&&synth.unlock())synth.noteOn(n,90);press(n);
  const release=()=>{held.delete(n);synth.noteOff(n);updateKeys();};window.addEventListener('pointerup',release,{once:true});window.addEventListener('pointercancel',release,{once:true});});
$('require-root').onchange=()=>{clearTimeout(advanceTimer);engine.requireRoot=$('require-root').checked;engine.reset(challenge);renderChallenge();};
$('connect').onclick=connect;$('skip').onclick=nextChallenge;$('device').onchange=refreshInputs;
$('reveal').onclick=()=>{revealed=!revealed;$('answer').textContent='Answer: '+noteName(challenge.root)+' → '+noteName(challenge.target)+', '+intervalName()+(challenge.sign>0?' up.':' down.');$('answer').hidden=!revealed;if(revealed&&ear())showInterval();updateKeys();};
$('listen').onclick=()=>{synth.unlock();listen();};
$('mode').onchange=()=>{synth.unlock();clearTimeout(advanceTimer);engine.reset(challenge);renderChallenge();};
$('volume').oninput=()=>{$('volume-label').textContent=$('volume').value+'%';synth.setVolume($('volume').value/100);};
$('key-sound').onchange=()=>{if(!keySound())synth.allOff();};
$('sound').onchange=()=>{synth.setSound($('sound').value);synth.unlock();};
synth.onload=failed=>{if(failed)$('sound-note').textContent=failed===30?'Piano recordings could not be loaded, so the soft tone is used. Check your connection and reload.':failed+' piano recordings could not be loaded; those notes use the soft tone.';};
// Audio can only start after a user gesture; unlock it on the first click or key press anywhere.
for(const type of ['pointerdown','keydown'])document.addEventListener(type,()=>synth.unlock(),{capture:true,once:true});
for(const id of ['direction','root-select'])$(id).onchange=nextChallenge;
window.addEventListener('pagehide',()=>{synth.allOff();if(midi)disconnect();});
renderChips();if(!nextChallenge())renderChallenge();
// Same visible actions, exposed only in browsers implementing WebMCP.
if(document.modelContext?.registerTool){const lifetime=new AbortController(),roots=['random',...[...$('root-select').options].map(o=>o.value).filter(v=>v!=='random')];window.addEventListener('pagehide',()=>lifetime.abort(),{once:true});
  for(const tool of [
    {name:'read_piano_practice',description:'Read the current mode, root, requested interval (hidden in ear training until answered), MIDI state, and session counts. Does not reveal the answer.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({mode:$('mode').value,root:noteName(challenge.root),...(ear()&&engine.stage!=='complete'?{}:{interval:intervals[challenge.gap-1][1],direction:challenge.sign>0?'up':'down'}),stage:engine.stage,requireRoot:engine.requireRoot,connected:!!midi,completed:score,wrongKeys:misses})},
    {name:'configure_piano_practice',description:'Change the root and direction, starting a new visible exercise. Does not request MIDI access.',inputSchema:{type:'object',properties:{root:{enum:roots},direction:{enum:['up','down','mixed']}},required:['root','direction'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||!roots.includes(input.root)||!['up','down','mixed'].includes(input.direction))throw new Error('Invalid root or direction');$('root-select').value=input.root;$('direction').value=input.direction;if(!nextChallenge())throw new Error('No playable interval for this configuration');return {root:noteName(challenge.root),interval:intervals[challenge.gap-1][1],direction:challenge.sign>0?'up':'down'};}}
  ]){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifetime.signal})).catch(()=>{});}catch{}}
}
