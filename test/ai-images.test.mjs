import test from "node:test";
import assert from "node:assert/strict";
import {normalizeAiImage,visionMessages,MAX_AI_IMAGE_BYTES} from "../ai-images.js";

const jpeg="data:image/jpeg;base64,"+Buffer.from([255,216,255,224,1,2,3,4]).toString("base64");
const png="data:image/png;base64,"+
  Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString("base64");

test("only compact valid inline JPEG/PNG images are accepted",()=>{
  assert.equal(normalizeAiImage(jpeg),jpeg);
  assert.equal(normalizeAiImage(png),png);
  assert.equal(normalizeAiImage("https://example.com/remote.jpg"),null);
  assert.equal(normalizeAiImage("data:image/svg+xml;base64,PHN2Zz4="),null);
  assert.equal(normalizeAiImage("data:image/png;base64,QUJDRA=="),null);
  assert.equal(normalizeAiImage("data:image/jpeg;base64,+/=="),null);
  assert.equal(normalizeAiImage("data:image/jpeg;base64,"+Buffer.alloc(MAX_AI_IMAGE_BYTES+1).toString("base64")),null);
});

test("NVIDIA vision input forwards the most recent screenshot with the latest question",()=>{
  const recent=[
    {role:"user",content:"What is this?",image:jpeg},
    {role:"assistant",content:"It looks like a UI."},
    {role:"user",content:"Can you read the error message?"}
  ];
  const messages=visionMessages(recent);
  assert.equal(messages[0].content,"What is this?");
  assert.equal(messages[1].content,"It looks like a UI.");
  assert.deepEqual(messages[2].content,[
    {type:"text",text:"Can you read the error message?"},
    {type:"image_url",image_url:{url:jpeg}}
  ]);
  assert.deepEqual(visionMessages([{role:"user",content:"Hello"}]),[{role:"user",content:"Hello"}]);
});

test("one attachment is used even if older messages carried images",()=>{
  const messages=visionMessages([
    {role:"user",content:"Earlier image",image:jpeg},
    {role:"assistant",content:"Earlier answer"},
    {role:"user",content:"Current image",image:png}
  ]);
  assert.deepEqual(messages[2].content[1].image_url,{url:png});
  assert.equal(typeof messages[0].content,"string");
});
