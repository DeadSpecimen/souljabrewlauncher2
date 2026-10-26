// Observe launch input independently of the finite render batches.
// Only request a mute here; the music player owns all audio SDK/queue operations.
const fs=require('node:fs/promises'),path=require('node:path');
function launchStarted(state,source){
 return !source.package&&state.readUInt32LE(784)===0&&
  (state.readFloatLE(964)!==0||state.readUInt32LE(1012)!==0);
}
async function main(directory){
 directory=path.resolve(directory);const rpc=require(path.join(directory,'shared/rpc.cjs'));
 let stop=false,latched=false;process.on('SIGTERM',()=>stop=true);process.on('SIGINT',()=>stop=true);
 console.log('Launch-input music control ready.');
 while(!stop){
  try{
   const source=JSON.parse(await fs.readFile(path.join(directory,'game-audio-source.json')));
   if(source.session!==rpc.a.session)throw Error('Music control session changed');
   const state=await rpc.read(source.mapped,1024),launch=launchStarted(state,source);
   if(launch&&!latched){
    const file=path.join(directory,'music-request.json'),temp=file+'.input.tmp';
    await fs.writeFile(temp,JSON.stringify({session:rpc.a.session,muted:true,reason:'launch-input',changed:new Date().toISOString()}));await fs.rename(temp,file);
    console.log('Music pause requested at launch input.');
   }
   latched=launch;
  }catch(error){
   if(error.code==='ECONNREFUSED'||error.code==='ECONNRESET')return;
   if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;
  }
  await new Promise(resolve=>setTimeout(resolve,25));
 }
}
module.exports={launchStarted};
if(require.main===module)main(process.argv[2]).catch(error=>{console.error(error);process.exitCode=1;});
