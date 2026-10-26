// Stream predecoded stereo PCM through the console's existing audio SDK.
// The intro plays once; when its last sample finishes, the loop track starts
// immediately and repeats until launch input or shutdown. Both songs are
// uploaded once; only buffer queue operations cross Wi-Fi.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {journal}=require('./journal.cjs');
const symbols=require('./audio-symbols.json');
const check=(v,m)=>{if(!v)throw Error(m);};
async function main(directory,introFile,loopFile,resume=false){
 directory=path.resolve(directory);introFile=path.resolve(introFile);loopFile=path.resolve(loopFile);
 const rpc=require(path.join(directory,'shared/rpc.cjs'));
 const sdkImage=require('../smilebasic/reference/sdk-checks.cjs');
 const intro=await fs.readFile(introFile),loop=await fs.readFile(loopFile);
 check(intro.length>0&&intro.length%4===0,'Expected stereo 48 kHz signed 16-bit PCM for '+introFile);
 check(loop.length>0&&loop.length%4===0,'Expected stereo 48 kHz signed 16-bit PCM for '+loopFile);
 const chunkBytes=48000*4*2,stride=Math.ceil(chunkBytes/65536)*65536;
 const introChunks=Math.ceil(intro.length/chunkBytes),loopChunks=Math.ceil(loop.length/chunkBytes);
 check((intro.length+loop.length)<=600*48000*4,'Combined music exceeds ten minutes');
 const count=introChunks+loopChunks,allocation=65536+count*stride;
 const file=path.join(directory,'music.json');let previous;
 if(resume){previous=JSON.parse(await fs.readFile(file));check(previous.completed&&previous.session===rpc.a.session&&previous.uploadVerified,'Music is active or cannot be resumed');await fs.rename(file,path.join(directory,'music-before-recovery-'+Date.now()+'.json'));}
 await fs.writeFile(file,'{}',{flag:'wx',mode:0o600});
 const report={session:rpc.a.session,started:new Date().toISOString(),source:[introFile,loopFile],sha256:crypto.createHash('sha256').update(intro).update(loop).digest('hex'),format:{rate:48000,channels:2,bits:16},durationSeconds:(intro.length+loop.length)/(48000*4),chunkSeconds:2,chunks:count,introChunks,loopChunks,functions:{},resourcesRetained:true,releasedBuffers:0,loopsQueued:0};
 const save=()=>fs.writeFile(file,JSON.stringify(report,null,2),{mode:0o600}),tracked=journal(report,save);
 async function call(key,...args){
  let f=report.functions[key];
  if(!f){const matches=symbols.filter(s=>s.name.includes(key));check(matches.length===1,'Ambiguous audio symbol '+key);const s=matches[0];await rpc.request({command:'verify-function',address:rpc.a.sdk+s.offset,hex:sdkImage.bytes(s.offset,Math.min(32,s.size)).toString('hex')});f=report.functions[key]=rpc.a.sdk+s.offset;}
  return tracked(key,args,()=>rpc.callAddress(f,args).then(r=>r.result));
 }
 let stop=false,audio,started=false;process.on('SIGINT',()=>stop=true);process.on('SIGTERM',()=>stop=true);
 const stopping=async()=>stop||await fs.access(path.join(directory,'music.stop')).then(()=>true,()=>false);
 try{
  const temp=rpc.a.scratch+0x10000,saved=await rpc.read(temp,8);let base=previous?.base;
  if(!previous)try{check((await rpc.call(5732112,[temp,65536,allocation])).result===0n,'Audio allocation failed');base=Number((await rpc.read(temp,8)).readBigUInt64LE());}finally{await rpc.write(temp,saved);}
  check(Number.isSafeInteger(base)&&base>0&&base%65536===0,'Invalid music allocation');report.base=base;report.bytes=allocation;await save();
  audio=base;const param=base+0x300,pcmBase=base+65536;
  if(previous){check(previous.sha256===report.sha256&&previous.bytes===allocation&&previous.audio===base,'Retained music differs');report.uploadVerified=true;report.resumedFrom=previous.started;}
  else{
  await rpc.write(base,Buffer.alloc(65536));
  console.log('Uploading '+(intro.length/(48000*4)).toFixed(1)+' seconds of intro and '+(loop.length/(48000*4)).toFixed(1)+' seconds of loop music.');
  for(let i=0;i<introChunks;i++){
   const chunk=Buffer.alloc(stride);intro.copy(chunk,0,i*chunkBytes,Math.min(intro.length,(i+1)*chunkBytes));await rpc.write(pcmBase+i*stride,chunk);
  }
  for(let j=0;j<loopChunks;j++){
   const chunk=Buffer.alloc(stride);loop.copy(chunk,0,j*chunkBytes,Math.min(loop.length,(j+1)*chunkBytes));await rpc.write(pcmBase+(introChunks+j)*stride,chunk);
  }
  // Verify the complete uploaded songs, ignoring alignment padding.
  const hash=crypto.createHash('sha256');
  for(let i=0;i<introChunks;i++)hash.update(await rpc.read(pcmBase+i*stride,Math.min(chunkBytes,intro.length-i*chunkBytes)));
  for(let j=0;j<loopChunks;j++)hash.update(await rpc.read(pcmBase+(introChunks+j)*stride,Math.min(chunkBytes,loop.length-j*chunkBytes)));
  check(hash.digest('hex')===report.sha256,'Uploaded music readback differs');report.uploadVerified=true;await save();
  await call('InitializeAudioOutParameter',param);const parameters=await rpc.read(param,8);parameters.writeUInt32LE(48000);parameters.writeUInt16LE(2,4);await rpc.write(param,parameters);
  const opened=await call('OpenDefaultAudioOutEPNS0_8AudioOutER',audio,param);report.openResult=String(opened);await save();check(opened===0n,'OpenDefaultAudioOut failed: '+opened);
  }
  const rate=Number(await call('GetAudioOutSampleRate',audio)),channels=Number(await call('GetAudioOutChannelCount',audio)),format=Number(await call('GetAudioOutSampleFormat',audio));check(rate===48000&&channels===2&&format===2,'Unexpected music output format');
  let next=0;const descriptors=new Set();const queued=new Map();
  for(let i=0;i<4;i++)descriptors.add(base+0x400+i*0x40);
  async function clearQueue(){
   check((await call('StopAudioOut',audio))===0n,'StopAudioOut failed');await call('FlushAudioOutBuffers',audio);
   for(let i=0;i<8;i++){const released=await call('GetReleasedAudioOutBuffer',audio);if(released===0n)break;check(descriptors.has(Number(released)),'Unexpected flushed audio descriptor');}
   check(Number(await call('GetAudioOutBufferCount',audio))===0,'Audio queue did not flush');queued.clear();
  }
  if(previous)await clearQueue();
  // Virtual chunk sequence: the intro plays once, then the loop track repeats.
  const physical=virtual=>virtual<introChunks?virtual:introChunks+((virtual-introChunks)%loopChunks);
  async function enqueue(descriptor){
   const offset=physical(next);let source,local;
   if(offset<introChunks){source=intro;local=offset;}else{source=loop;local=offset-introChunks;}
   const bytes=Math.min(chunkBytes,source.length-local*chunkBytes);
   await call('SetAudioOutBufferInfo',descriptor,pcmBase+offset*stride,stride,bytes);
   check((await call('AppendAudioOutBuffer',audio,descriptor))===1n,'Music buffer rejected');queued.set(descriptor,{chunk:next,bytes});
   next++;if(next>=introChunks+loopChunks&&(next-introChunks)%loopChunks===0)report.loopsQueued++;
  }
  for(const descriptor of descriptors)await enqueue(descriptor);
  check((await call('StartAudioOut',audio))===0n,'StartAudioOut failed');started=true;report.playing=true;report.audio=audio;report.ready=true;await save();
  console.log('Homebrew Channel music started on the console audio output.');
  let nextStatus=0,lastProgress=Date.now(),lastSamples=-1n,muted=false;
  async function desiredMute(){try{const request=JSON.parse(await fs.readFile(path.join(directory,'music-request.json')));return request.session===rpc.a.session&&request.muted===true;}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return muted;throw error;}}
  async function recordState(){report.muted=muted;report.playing=!muted;report.outputState=String(await call('GetAudioOutState',audio));report.lastVerified=new Date().toISOString();await fs.writeFile(path.join(directory,'music-control.json'),JSON.stringify({session:rpc.a.session,audio,muted,state:report.outputState,changed:report.lastVerified},null,2));await save();}
  await recordState();
  while(!await stopping()){
   const requested=await desiredMute();
   if(requested!==muted){
    if(requested){const first=queued.values().next().value;if(first)next=first.chunk;await clearQueue();}
    else{for(const descriptor of descriptors)await enqueue(descriptor);check((await call('StartAudioOut',audio))===0n,'Resume failed');}
    muted=requested;lastProgress=Date.now();lastSamples=-1n;await recordState();console.log(muted?'Music paused.':'Music resumed.');
   }
   // Recycle a descriptor only after the service explicitly releases it.
   for(let i=0;!muted&&i<4;i++){
    const released=await call('GetReleasedAudioOutBuffer',audio);if(released===0n)break;
    const descriptor=Number(released);check(descriptors.has(descriptor)&&queued.has(descriptor),'Unexpected released audio descriptor');queued.delete(descriptor);report.releasedBuffers++;await enqueue(descriptor);
   }
   if(Date.now()>=nextStatus){
    report.playedSamples=String(await call('GetAudioOutPlayedSampleCount',audio));report.queuedBuffers=Number(await call('GetAudioOutBufferCount',audio));
    const samples=BigInt(report.playedSamples);if(samples!==lastSamples){lastSamples=samples;lastProgress=Date.now();}
    if(!muted&&Date.now()-lastProgress>5000){await clearQueue();for(const descriptor of descriptors)await enqueue(descriptor);check((await call('StartAudioOut',audio))===0n,'Audio recovery failed');report.recoveries=(report.recoveries||0)+1;lastProgress=Date.now();}
    report.lastVerified=new Date().toISOString();await save();
    console.log('Music: '+(Number(report.playedSamples)/48000).toFixed(1)+'s played; '+report.queuedBuffers+' buffers queued.');nextStatus=Date.now()+5000;
   }
   await new Promise(resolve=>setTimeout(resolve,50));
  }
 }catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
 finally{
  if(started){try{check((await call('StopAudioOut',audio))===0n,'StopAudioOut failed');await call('FlushAudioOutBuffers',audio);report.playing=false;}catch(error){report.stopError=error.message;}}
  report.completed=new Date().toISOString();await save();
 }
}
if(require.main===module)main(process.argv[2],process.argv[3],process.argv[4],process.argv[5]==='--resume').catch(error=>{console.error(error);process.exitCode=1;});
