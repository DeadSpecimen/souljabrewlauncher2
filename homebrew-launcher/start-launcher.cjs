// Start a fresh native session and restore the launcher/music when the Pico connects.
const {spawn}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const children=new Set();
let stopping;
function start(script,args=[],readyText){
 const child=spawn(process.execPath,[script,...args],{cwd:root,stdio:['ignore','pipe','inherit']});
 child.script=script;children.add(child);let output='',readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 // Some stages only need completion; keep unused readiness rejections handled.
 ready.catch(()=>{});
 child.stdout.on('data',bytes=>{
  process.stdout.write(bytes);output=(output+bytes).slice(-32768);
  if(readyText&&output.includes(readyText))readyResolve(output);
 });
 const done=new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('close',(code,signal)=>{children.delete(child);readyReject(Error(script+' exited before ready'));if(code===0)resolve(output);else reject(Error(script+' exited: '+(signal||code)));});
 });
 done.catch(()=>{});return {child,ready,done};
}
function stop(){
 if(stopping)return stopping;
 stopping=(async()=>{
  async function end(child){
   if(!children.has(child))return;
   await new Promise(resolve=>{const timer=setTimeout(resolve,5000);child.once('close',()=>{clearTimeout(timer);resolve();});child.kill('SIGTERM');});
  }
  // Keep RPC alive until both audio owners have stopped their console outputs.
  await Promise.all([...children].filter(c=>c.script==='homebrew-launcher/music-controls.cjs').map(end));
  await Promise.all([...children].filter(c=>/\/(?:music|game-audio)\.cjs$/.test(c.script)).map(end));
  await Promise.all([...children].filter(c=>c.script!=='smilebasic/host.cjs').map(end));
  await Promise.all([...children].map(end));
 })();return stopping;
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
async function main(){
 const host=start('smilebasic/host.cjs',process.argv.slice(2),'Qualified native session ready for graphics inspection.');
 try{
  const output=await host.ready;
  const match=output.match(/Run folder: ([^\r\n]+)/);if(!match)throw Error('Missing fresh run directory');
  const directory=match[1];
  const stages=[['homebrew-launcher/inspect-display.cjs'],['homebrew-launcher/inspect-compatibility.cjs'],['homebrew-launcher/inspect-input.cjs'],['homebrew-launcher/vulkan-copy.cjs','display'],['homebrew-launcher/launcher.cjs','auto'],['homebrew-launcher/launcher-check.cjs','auto']];
  for(const [script,...args] of stages)await start(script,[directory,...args]).done;
  const music=start('homebrew-launcher/music.cjs',[directory,'homebrew-launcher/audio/intro.pcm','homebrew-launcher/audio/loop.pcm'],'Homebrew Channel music started on the console audio output.');
  await music.ready;
  const graphics=start('homebrew-launcher/launcher-loop.cjs',[directory,'auto'],'HBLauncher game event source ready.');
  await graphics.ready;
  const controls=start('homebrew-launcher/music-controls.cjs',[directory],'Launch-input music control ready.');await controls.ready;
  const effects=start('homebrew-launcher/game-audio.cjs',[directory],'Game sound effects ready.');await effects.ready;
  console.log('HBLauncher GPU app runtime, music, and package sound effects are running.');
  await Promise.race([host.done,music.done,graphics.done,controls.done]);
 }finally{await stop();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
