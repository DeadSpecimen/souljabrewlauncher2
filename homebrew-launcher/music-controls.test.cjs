const test=require('node:test'),assert=require('node:assert/strict');
const {launchStarted}=require('./music-controls.cjs');
test('Music pause is requested at the first fade frame, before black/dispatch',()=>{
 const b=Buffer.alloc(1024);b.writeFloatLE(1,964);assert.equal(b.readFloatLE(960),0);assert.equal(b.readUInt32LE(1012),0);
 assert.equal(launchStarted(b,{package:null}),true);
});
test('Navigation, return fade, and running apps do not request another pause',()=>{
 const b=Buffer.alloc(1024);b.writeFloatLE(.7,960);assert.equal(launchStarted(b,{package:null}),false);
 b.writeFloatLE(1,964);assert.equal(launchStarted(b,{package:{id:'hello-world'}}),false);
 b.writeUInt32LE(1,784);assert.equal(launchStarted(b,{package:null}),false);
});
