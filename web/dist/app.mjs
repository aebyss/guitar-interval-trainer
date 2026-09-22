import {detectPitch,noteName,noteFrequency,pitchMidi,intervals,makeChallenge,PracticeEngine} from './pitch.mjs';
const $=id=>document.getElementById(id);
let enabled=new Set([3,4,5,7,12]),challenge={root:45,target:49,gap:4,sign:1},engine=new PracticeEngine(challenge);
let context=null,stream=null,source=null,splitter=null,analyzers=[],buffers=[],frame=0,advanceTimer=0,score=0,connecting=false,generation=0,lastFrame=0;
const errorMessages={NotAllowedError:'Audio access was denied. Allow microphone access in your browser’s site settings, then reconnect.',NotFoundError:'No audio input was found. Connect your interface and try again.',NotReadableError:'Your audio input could not be opened. Check the interface or close another app using it.',OverconstrainedError:'This input is no longer available. Choose another audio input and reconnect.'};
function showError(message){$('error').textContent=message;$('error').hidden=!message;}
function renderChallenge(){
  const root=noteName(challenge.root);$('root-note').replaceChildren(document.createTextNode(root.slice(0,-1)),Object.assign(document.createElement('span'),{textContent:root.slice(-1)}));
  $('root-frequency').textContent=noteFrequency(challenge.root).toFixed(1)+' Hz';$('interval-name').textContent=intervals[challenge.gap-1][1];
  $('direction-label').textContent='PLAY '+(challenge.sign>0?'ABOVE':'BELOW')+' THE ROOT';document.querySelector('.arrow').textContent=challenge.sign>0?'↗':'↘';
  $('semitones').textContent=challenge.gap+' semitone'+(challenge.gap===1?'':'s')+' '+(challenge.sign>0?'up':'down');$('answer').hidden=true;
  $('step-root').className=engine.requireRoot?'step active':'step reference';$('step-root').lastChild.textContent=engine.requireRoot?' Play the root':' Root reference';$('step-target').className=engine.requireRoot?'step':'step active';document.querySelector('.practice').classList.remove('success');$('hold-progress').style.width='0%';
  $('feedback').textContent=stream?(engine.requireRoot?'Play '+noteName(challenge.root)+' and hold it briefly.':'Play the requested interval from '+noteName(challenge.root)+'. No need to play the root first.'):'Connect your audio interface, then play '+(engine.requireRoot?'the root note.':'the requested interval.');
}
function nextChallenge(){
  clearTimeout(advanceTimer);
  const next=makeChallenge($('root-select').value,$('direction').value,[...enabled],challenge);
  if(!next){showError('These descending intervals go below standard guitar range. Choose a higher root or another interval.');$('connect').disabled=!stream;engine.reset(null);return false;}
  showError('');$('connect').disabled=connecting;challenge=next;engine.reset(challenge);renderChallenge();return true;
}
function renderChips(){
  $('interval-options').replaceChildren(...intervals.map(([short,name],i)=>{const button=document.createElement('button');button.type='button';button.className='chip';button.textContent=short;button.title=name;button.setAttribute('aria-label',name);button.setAttribute('aria-pressed',String(enabled.has(i+1)));button.onclick=()=>{if(enabled.has(i+1)){if(enabled.size===1)return;enabled.delete(i+1);}else enabled.add(i+1);renderChips();nextChallenge();};return button;}));
}
async function listDevices(){
  const selected=$('device').value;const devices=await navigator.mediaDevices.enumerateDevices();
  $('device').replaceChildren(new Option('System default',''),...devices.filter(d=>d.kind==='audioinput').map((d,i)=>new Option(d.label||'Audio input '+(i+1),d.deviceId)));
  if([...$('device').options].some(o=>o.value===selected))$('device').value=selected;
}
function stopAudio(){
  generation++;clearTimeout(advanceTimer);cancelAnimationFrame(frame);
  stream?.getTracks().forEach(t=>t.stop());stream=null;source?.disconnect();splitter?.disconnect();analyzers.forEach(a=>a.disconnect());
  if(context){context.onstatechange=null;void context.close().catch(()=>{});}context=null;analyzers=[];buffers=[];engine.reset(challenge);connecting=false;
  $('connect').disabled=false;$('connect').innerHTML='Connect guitar <span>↗</span>';$('connection').textContent='●  INPUT OFF';$('connection').className='badge';
  $('detected-note').textContent='—';$('frequency').textContent='— Hz';$('pitch-message').textContent='Your guitar goes here.';$('cents').textContent='Connect your input to begin';$('needle').style.opacity=0;
  document.querySelectorAll('.signal-bars i').forEach(bar=>{bar.style.height='7px';bar.style.opacity='.3';});renderChallenge();
}
async function connectAudio(){
  if(stream){stopAudio();return;}if(connecting)return;
  if(!navigator.mediaDevices?.getUserMedia){showError('Audio input needs a secure browser page. Open the published HTTPS app or run it on localhost in Chrome, Edge, Firefox, or Safari.');return;}
  if(!engine.challenge&&!nextChallenge())return;
  connecting=true;$('connect').disabled=true;$('connect').textContent='Connecting…';showError('');const token=++generation;
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Web Audio is unavailable in this browser.');
    context=new Audio();await context.resume();
    const input=await navigator.mediaDevices.getUserMedia({audio:{...( $('device').value?{deviceId:{exact:$('device').value}}:{}),channelCount:{ideal:2},echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    if(token!==generation){input.getTracks().forEach(t=>t.stop());return;}stream=input;
    const channels=Math.max(1,Math.min(2,stream.getAudioTracks()[0].getSettings().channelCount||1));
    source=context.createMediaStreamSource(stream);splitter=context.createChannelSplitter(channels);source.connect(splitter);
    analyzers=Array.from({length:channels},(_,i)=>{const a=context.createAnalyser();a.fftSize=4096;a.smoothingTimeConstant=0;splitter.connect(a,i);return a;});buffers=analyzers.map(()=>new Float32Array(4096));
    $('channel').options[2].disabled=channels<2;if(channels<2&&$('channel').value==='1')$('channel').value='0';
    stream.getTracks().forEach(t=>t.addEventListener('ended',()=>{stopAudio();showError('Your audio input disconnected. Reconnect your interface and try again.');},{once:true}));
    context.onstatechange=()=>{if(context?.state==='suspended'){engine.since=null;engine.progress=0;showError('Audio paused by the browser. Disconnect and reconnect to resume.');}};
    await listDevices();if(token!==generation)return;
    connecting=false;$('connect').disabled=false;$('connect').innerHTML='Disconnect <span>×</span>';$('connection').className='badge connected';$('connection').textContent='●  LISTENING';engine.reset(challenge);renderChallenge();frame=requestAnimationFrame(tick);
  }catch(error){if(token!==generation)return;stopAudio();showError(errorMessages[error.name]||error.message||'Could not start audio. Check your input and try again.');}
}
function tick(time){
  if(!stream||!context)return;
  frame=requestAnimationFrame(tick);if(time-lastFrame<35)return;lastFrame=time;
  let selected=0,bestEnergy=-1;
  for(let i=0;i<analyzers.length;i++){analyzers[i].getFloatTimeDomainData(buffers[i]);let e=0;for(const x of buffers[i])e+=x*x;if(e>bestEnergy){bestEnergy=e;selected=i;}}
  if($('channel').value!=='auto')selected=Math.min(Number($('channel').value),buffers.length-1);
  const pitch=detectPitch(buffers[selected],context.sampleRate);const frequency=pitch.frequency;
  document.querySelectorAll('.signal-bars i').forEach((bar,i)=>{bar.style.height=(5+Math.min(1,pitch.rms*12)*(10+[8,18,26,18,8][i]))+'px';bar.style.opacity=pitch.rms>.006?'1':'.3';bar.style.background=pitch.peak>.98?'#ffad85':'var(--lime)';});
  if(frequency){const midi=pitchMidi(frequency),rounded=Math.round(midi),cents=Math.round((midi-rounded)*100);$('detected-note').textContent=noteName(rounded);$('frequency').textContent=frequency.toFixed(1)+' Hz';$('needle').style.opacity=1;$('needle').style.left=(50+Math.max(-50,Math.min(50,cents))*.9)+'%';$('cents').textContent=(cents>0?'+':'')+cents+' cents · Input '+(selected+1);
    const expected=engine.stage==='root'?challenge.root:challenge.target;
    $('pitch-message').textContent=Math.abs((midi-expected)*100)<=Number($('tolerance').value)?'That’s it. Hold steady.':engine.stage==='root'?'Find the root '+noteName(challenge.root):Math.round(midi)%12===expected%12?'Right note, different octave.':Math.round(midi)===expected?'Right note — adjust your tuning.':'Keep finding the interval.';
  }else{$('detected-note').textContent='—';$('frequency').textContent='— Hz';$('needle').style.opacity=0;$('pitch-message').textContent=pitch.rms>.006?'Play one clear note.':'Listening for your guitar…';$('cents').textContent=pitch.rms>.006?'Mute the other strings':'Input '+(selected+1)+' · Check gain if the meter stays still';}
  if(pitch.peak>.98)$('cents').textContent='Input clipping — turn down your interface gain';
  if(document.hidden||context.state!=='running'){engine.since=null;return;}
  const event=engine.feed(pitch.peak>.98?null:frequency,time,Number($('tolerance').value));$('hold-progress').style.width=engine.progress*100+'%';
  if(event==='root'){$('step-root').className='step done';$('step-target').className='step active';$('feedback').textContent='Root found. Mute it, then play the '+intervals[challenge.gap-1][1].toLowerCase()+'.';}
  if(event==='target')$('feedback').textContent='Play the '+intervals[challenge.gap-1][1].toLowerCase()+' '+(challenge.sign>0?'above':'below')+' '+noteName(challenge.root)+'.';
  if(event==='correct'){score++;$('score').textContent=score;$('step-target').className='step done';document.querySelector('.practice').classList.add('success');$('feedback').textContent='Correct! '+noteName(challenge.root)+' → '+noteName(challenge.target)+'. Next interval coming…';advanceTimer=setTimeout(nextChallenge,1100);}
  if(engine.stage==='complete')$('pitch-message').textContent='Correct. Nicely played.';
}
$('require-root').onchange=()=>{clearTimeout(advanceTimer);engine.requireRoot=$('require-root').checked;engine.reset(challenge);renderChallenge();};
$('connect').onclick=connectAudio;$('skip').onclick=nextChallenge;
$('reveal').onclick=()=>{$('answer').textContent='Answer: '+noteName(challenge.root)+' → '+noteName(challenge.target)+' ('+noteFrequency(challenge.target).toFixed(1)+' Hz).';$('answer').hidden=!$('answer').hidden;};
for(const id of ['direction','root-select'])$(id).onchange=nextChallenge;
$('tolerance').oninput=()=>{$('tolerance-label').textContent='±'+$('tolerance').value+' cents';engine.since=null;engine.progress=0;};
$('channel').onchange=()=>{clearTimeout(advanceTimer);engine.reset(challenge);renderChallenge();};
$('device').onchange=async()=>{if(stream){stopAudio();await connectAudio();}};
navigator.mediaDevices?.addEventListener('devicechange',()=>{listDevices().catch(()=>{});});
window.addEventListener('pagehide',stopAudio);document.addEventListener('visibilitychange',()=>{engine.since=null;engine.releaseSince=null;engine.progress=0;});
renderChips();renderChallenge();
// Same visible actions, exposed only in browsers implementing WebMCP.
if(document.modelContext?.registerTool){const lifetime=new AbortController();window.addEventListener('pagehide',()=>lifetime.abort(),{once:true});
  for(const tool of [
    {name:'read_guitar_practice',description:'Read the current root, requested interval, input state, and session count. Does not reveal the answer.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({root:noteName(challenge.root),interval:intervals[challenge.gap-1][1],direction:challenge.sign>0?'up':'down',stage:engine.stage,requireRoot:engine.requireRoot,connected:!!stream,completed:score})},
    {name:'configure_guitar_practice',description:'Change the root and direction, starting a new visible exercise. Does not open the microphone.',inputSchema:{type:'object',properties:{root:{enum:['random','45','52','55','57','60']},direction:{enum:['up','down','mixed']}},required:['root','direction'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||!['random','45','52','55','57','60'].includes(input.root)||!['up','down','mixed'].includes(input.direction))throw new Error('Invalid root or direction');if(!makeChallenge(input.root,input.direction,[...enabled]))throw new Error('No playable interval for this configuration');$('root-select').value=input.root;$('direction').value=input.direction;nextChallenge();return {root:noteName(challenge.root),interval:intervals[challenge.gap-1][1],direction:challenge.sign>0?'up':'down'};}}
  ]){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifetime.signal})).catch(()=>{});}catch{}}
}
