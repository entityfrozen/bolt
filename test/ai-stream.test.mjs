import test from "node:test";
import assert from "node:assert/strict";
import {readAiCompletionStream} from "../ai-stream.js";

const streamResponse=chunks=>new Response(new ReadableStream({
 start(controller){
  for(const chunk of chunks)controller.enqueue(new TextEncoder().encode(chunk));
  controller.close();
 }
}),{headers:{"Content-Type":"text/event-stream"}});

test("NVIDIA's split SSE chunks join into final text without exposing reasoning",async()=>{
 const source=[
  'data: {"choices":[{"delta":{"reasoning_content":"private","content":"Hel',
  'lo "}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
  'data: {"choices":[{"delta":{"reasoning_content":"do not reveal"}}]}\n\n',
  'data: [DONE]\n\n'
 ];
 const deltas=[];
 const reply=await readAiCompletionStream(streamResponse(source),part=>deltas.push(part));
 assert.equal(reply,"Hello world");
 assert.deepEqual(deltas,["Hello ","world"]);
});

test("Provider stream errors do not create fake answers",async()=>{
 const response=streamResponse(['data: {"error":{"message":"Provider busy"}}\n\n']);
 await assert.rejects(readAiCompletionStream(response),/Provider busy/);
});

test("Provider stream requires actual final-answer content",async()=>{
 await assert.rejects(readAiCompletionStream(streamResponse([
  'data: {"choices":[{"delta":{"reasoning_content":"private only"}}]}\n\n',
  'data: [DONE]\n\n'
 ])),/no final answer/i);
});

test("SSE parser accepts multiple events and split newline delimiters",async()=>{
 const stream=streamResponse([
  'data: {"choices":[{"delta":{"content":"One"}}]}\n',
  '\ndata: {"choices":[{"delta":{"content":" two"}}]}\r',
  '\n\r\ndata: [DONE]\n\n'
 ]);
 assert.equal(await readAiCompletionStream(stream),"One two");
});
