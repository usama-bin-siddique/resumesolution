import test from 'node:test';
import assert from 'node:assert/strict';
import {readAPIResponse} from '../src/lib/api-response.ts';
test('hosting text and HTML errors produce a safe service message',async()=>{
 for(const [body,type] of [['The page could not be found','text/plain'],['<html>Not found</html>','text/html'],['invalid','application/json']]){
 await assert.rejects(readAPIResponse(new Response(body,{status:404,headers:{'content-type':type}})),/This service is unavailable/);
 }
});
test('valid API payloads including errors remain available to callers',async()=>{
 for(const body of [{remaining:5,configured:true},{error:'Daily limit reached.'}])assert.deepEqual(await readAPIResponse(Response.json(body)),body);
});
