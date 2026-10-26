// The launcher is the SDK integration fixture. No diagnostics menu or separate app.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const L=require('../host/layout.cjs');
async function main(){
 const root=path.resolve(__dirname,'../..'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'hb-sdk-launcher-'));
 async function step(state,buttons){const input=Buffer.alloc(64);input.writeUInt32LE(buttons,8);input.writeUInt32LE(1,32);await fs.writeFile(path.join(dir,'state'),state);await fs.writeFile(path.join(dir,'input'),input);execFileSync(path.join(root,'homebrew-launcher/game-compute-check'),[path.join(dir,'state'),path.join(dir,'out'),path.join(root,'homebrew-launcher/shaders/launcher.comp.spv'),path.join(dir,'input'),'1'],{env:{...process.env,HB_FULL_OUTPUT:'1'},stdio:'pipe'});return fs.readFile(path.join(dir,'out'));}
 let state=Buffer.alloc(8*1024*1024);state.writeUInt32LE(L.MAGIC,L.OFFSET);state.writeUInt32LE(L.VERSION,L.OFFSET+4);state.writeUInt32LE(32,L.OFFSET+12);state.writeUInt32LE(1,112);state.writeUInt32LE(1,1020);
 const ring=L.OFFSET+0x4000+712,record=ring+32+40;state.writeUInt32LE(1,ring+16);state.writeUInt32LE(1,ring+24);state.writeBigUInt64LE(2n,record);state.writeBigUInt64LE(1n,record+16);state.writeInt32LE(20,record+24);state.writeInt32LE(-10,record+28);state.writeUInt32LE(3,record+32);
 state=await step(state,0);assert.equal(state.readFloatLE(816),990,'optical X delta');assert.equal(state.readFloatLE(820),525,'optical Y delta');
 state=await step(state,0);assert.equal(state.readFloatLE(816),990,'sample applied once');
 state.writeBigUInt64LE(3n,record);state.writeBigUInt64LE(2n,record+16);state=await step(state,0);assert.equal(state.readFloatLE(816),990,'inconsistent entry rejected');
 state=await step(state,8);assert.equal(state.readUInt32LE(92),0,'Y does not open a system menu');assert.equal(state.readUInt32LE(L.OFFSET+2048),0,'launcher has no diagnostic requests');
 // Restore a stable optical sample and verify mode-specific shoulder clicks.
 state.writeBigUInt64LE(4n,record);state.writeBigUInt64LE(2n,record+16);state.writeInt32LE(0,record+24);state.writeInt32LE(0,record+28);
 const shoulder=Buffer.from(state);shoulder.writeFloatLE(1490,816);shoulder.writeFloatLE(179,820);
 let click=await step(shoulder,64);assert.equal(click.readUInt32LE(120),0,'L ignored when only right mouse tracks');
 click=await step(shoulder,128);assert.equal(click.readUInt32LE(120),1,'R clicks the speaker in right mouse mode');assert.equal(click.readUInt32LE(1004),1,'tracking shows cursor');
 shoulder.writeUInt32LE(1,record+32);click=await step(shoulder,128);assert.equal(click.readUInt32LE(120),0,'R ignored outside optical tracking');assert.equal(click.readUInt32LE(1004),0,'cursor hides outside mouse mode');
 state=await step(state,512);assert.equal(state.readFloatLE(964),1,'ZR on the hovered row launches selection');
 console.log('SDK launcher passed: optical movement, deduplication, torn-record rejection, no System menu, mode-specific shoulder clicks, cursor hiding, ZR launch.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
