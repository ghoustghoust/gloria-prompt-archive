import test from 'node:test';
import assert from 'node:assert/strict';
import { createLikesClient } from '../src/likes-client.js';
function setup() {
  const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  let n=0,failAfterCommit=false;const votes=new Set();
  async function fetcher(url,options){
    const path=new URL(url).pathname;const token=options.headers.Authorization || '';
    const body=options.body?JSON.parse(options.body):{};
    if(path==='/api/visitors')return Response.json({token:String(++n).padStart(64,'a')},{status:201});
    const state={count:votes.size,liked:votes.has(token)};
    if(path==='/api/counts')return Response.json({items:Object.fromEntries(body.ids.map(id=>[id,state]))});
    if(path.startsWith('/api/likes/')){
      if(body.liked)votes.add(token);else votes.delete(token);
      if(failAfterCommit){failAfterCommit=false;throw new TypeError('connection lost');}
      return Response.json({count:votes.size,liked:votes.has(token)});
    }
    throw new Error('unexpected request');
  }
  const client=()=>createLikesClient({api:'https://likes.example',fetcher,storage});
  return {storage,client,votes,failOnce(){failAfterCommit=true;}};
}
test('reload reuses the visitor and knows that it has already liked',async()=>{
  const env=setup();const first=env.client();await first.toggle('a'.repeat(14));assert.equal(env.votes.size,1);
  const reload=env.client();await reload.load(['a'.repeat(14)]);assert.equal(reload.states.get('a'.repeat(14)).liked,true);
  await reload.toggle('a'.repeat(14));assert.equal(env.votes.size,0);
});
test('rapid double click and lost response do not submit two votes',async()=>{
  const env=setup();const client=env.client();env.failOnce();
  await Promise.all([client.toggle('a'.repeat(14)),client.toggle('a'.repeat(14))]);
  assert.equal(env.votes.size,1);assert.equal(client.states.get('a'.repeat(14)).liked,true);
  await client.toggle('a'.repeat(14));assert.equal(env.votes.size,0);
});
test('blocked browser storage prevents an unremembered vote',async()=>{
  const env=setup();const client=createLikesClient({api:'https://likes.example',fetcher:async()=>Response.json({token:'a'.repeat(64)},{status:201}),storage:{getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}}});
  await assert.rejects(client.toggle('a'.repeat(14)),/无法保存/);assert.equal(env.votes.size,0);
});
