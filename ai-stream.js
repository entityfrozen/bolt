// Parse OpenAI-compatible data-only SSE without exposing internal reasoning.
// Only assistant final-answer deltas are forwarded to the UI.
export async function readAiCompletionStream(response,onContent=()=>{}){
 if(!response.body)throw new Error("AI provider did not return a stream.");
 const decoder=new TextDecoder();
 const reader=response.body.getReader();
 let buffer="",reply="",finished=false;
 function receive(event){
  const dataLines=event.split(/\r?\n/).filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trimStart());
  if(!dataLines.length)return;
  const payload=dataLines.join("\n").trim();
  if(payload==="[DONE]"){finished=true;return;}
  let message;
  try{message=JSON.parse(payload)}catch{throw new Error("The AI provider sent malformed stream data.");}
  if(message.error)throw new Error(String(message.error.message||"The AI provider failed while generating.").slice(0,220));
  const choice=message.choices?.[0];
  const chunk=choice?.delta?.content;
  if(typeof chunk==="string"&&chunk){
   const available=Math.max(0,18000-reply.length);
   const text=chunk.slice(0,available);
   if(text){reply+=text;onContent(text);}
  }
 }
 try{
  while(!finished){
   const {value,done}=await reader.read();
   if(done)break;
   buffer+=decoder.decode(value,{stream:true});
   if(buffer.length>100000)throw new Error("The AI stream was too large.");
   let boundary;
   while((boundary=buffer.search(/\r?\n\r?\n/))>=0){
    const split=buffer.match(/\r?\n\r?\n/);
    const event=buffer.slice(0,boundary);
    buffer=buffer.slice(boundary+split[0].length);
    receive(event);
    if(finished)break;
   }
  }
  if(!finished&&buffer.trim())receive(buffer);
  if(!reply.trim())throw new Error("The AI provider returned no final answer. Please retry.");
  return reply;
 }finally{try{await reader.cancel()}catch{}reader.releaseLock();}
}
