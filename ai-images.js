// Accept compact inline images for Lightning's vision-enabled assistant.
// Never fetch user-supplied URLs from our server: only verified base64 pixels.
const PREFIX=/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;
export const MAX_AI_IMAGE_BYTES=120_000;
export function normalizeAiImage(value) {
  if(typeof value!=="string"||value.length>165_000)return null;
  const match=PREFIX.exec(value);
  if(!match)return null;
  const raw=match[2];
  if(raw.length%4!==0)return null;
  const bytes=Buffer.from(raw,"base64");
  if(!bytes.length||bytes.length>MAX_AI_IMAGE_BYTES)return null;
  if(bytes.toString("base64")!==raw)return null;
  if(match[1]==="jpeg"&&!(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff))return null;
  if(match[1]==="png"&&!(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))))return null;
  return value;
}
export function visionMessages(messages) {
  let lastImage=null;
  for(const message of messages){
    if(message.role==="user"&&message.image)lastImage=message.image;
  }
  const lastUser=messages.findLastIndex(message=>message.role==="user");
  return messages.map((message,index)=>{
    if(index!==lastUser||!lastImage)return {role:message.role,content:message.content};
    return {role:"user",content:[
      {type:"text",text:message.content},
      {type:"image_url",image_url:{url:lastImage}}
    ]};
  });
}
