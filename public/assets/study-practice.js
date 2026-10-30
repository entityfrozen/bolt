// Small learning exercises for the public study dashboard.
(()=>{
 "use strict";
 const byId=id=>document.getElementById(id);
 const mathPrompt=byId("practiceMathQuestion");
 const mathInput=byId("practiceMathAnswer");
 const mathFeedback=byId("practiceMathFeedback");
 const sciencePrompt=byId("practiceScienceQuestion");
 const scienceOptions=byId("practiceScienceOptions");
 const scienceFeedback=byId("practiceScienceFeedback");
 if(!mathPrompt||!mathInput||!mathFeedback||!sciencePrompt||!scienceOptions||!scienceFeedback)return;
 const random=(min,max)=>min+Math.floor(Math.random()*(max-min+1));
 const questions=[
  {question:"What gas do plants take in during photosynthesis?",choices:["Oxygen","Carbon dioxide","Helium"],correct:1,explain:"Plants use carbon dioxide, water, and light to make food."},
  {question:"What is the closest star to Earth?",choices:["The Sun","Sirius","Polaris"],correct:0,explain:"The Sun is the star at the center of our solar system."},
  {question:"At sea level, water normally freezes at what temperature?",choices:["100 °C","0 °C","50 °C"],correct:1,explain:"Pure water freezes at 0 °C under standard pressure."},
  {question:"Which force keeps us on the ground?",choices:["Magnetism","Friction","Gravity"],correct:2,explain:"Gravity attracts objects with mass toward Earth."},
  {question:"Which organ pumps blood around the human body?",choices:["Lungs","Heart","Liver"],correct:1,explain:"The heart pumps blood through blood vessels."},
  {question:"What part of a plant absorbs most of its water?",choices:["Roots","Petals","Flowers"],correct:0,explain:"Roots take up water and minerals from soil."},
  {question:"What is the chemical symbol for water?",choices:["O₂","CO₂","H₂O"],correct:2,explain:"A water molecule contains two hydrogen atoms and one oxygen atom."},
  {question:"Which planet is known for its large ring system?",choices:["Mars","Saturn","Mercury"],correct:1,explain:"Saturn is famous for its broad rings made largely of ice particles."}
 ];
 let solution=20,scienceIndex=-1,scienceAnswered=false;
 function resetFeedback(node,message){
  node.textContent=message;
  node.classList.remove("correct","incorrect");
 }
 function nextMath(){
  const mode=random(0,2);
  let left=random(3,22),right=random(2,18),symbol="+";
  if(mode===1){
   symbol="−";
   if(right>left)[left,right]=[right,left];
   solution=left-right;
  }else if(mode===2){
   left=random(2,12);right=random(2,12);symbol="×";
   solution=left*right;
  }else solution=left+right;
  mathPrompt.textContent=left+" "+symbol+" "+right+" = ?";
  mathInput.value="";
  resetFeedback(mathFeedback,"Try it without a calculator.");
 }
 function nextScience(){
  if(questions.length===1)scienceIndex=0;
  else{
   const previous=scienceIndex;
   do{scienceIndex=random(0,questions.length-1);}while(scienceIndex===previous);
  }
  const question=questions[scienceIndex];
  scienceAnswered=false;
  sciencePrompt.textContent=question.question;
  scienceOptions.replaceChildren();
  question.choices.forEach((answer,index)=>{
   const button=document.createElement("button");
   button.type="button";
   button.dataset.scienceAnswer=String(index);
   button.textContent=answer;
   scienceOptions.append(button);
  });
  resetFeedback(scienceFeedback,"Choose the best answer.");
 }
 byId("practiceMathForm")?.addEventListener("submit",event=>{
  event.preventDefault();
  if(mathInput.value.trim()==="")return;
  const correct=Number(mathInput.value)===solution;
  resetFeedback(mathFeedback,correct?"Correct! Nicely done.":"Not quite. Give it another try.");
  mathFeedback.classList.add(correct?"correct":"incorrect");
 });
 byId("practiceNextMath")?.addEventListener("click",nextMath);
 scienceOptions.addEventListener("click",event=>{
  const button=event.target.closest("[data-science-answer]");
  if(!button||scienceAnswered)return;
  const question=questions[scienceIndex];
  const correct=Number(button.dataset.scienceAnswer)===question.correct;
  scienceAnswered=true;
  for(const option of scienceOptions.querySelectorAll("button")){
   option.disabled=true;
   const index=Number(option.dataset.scienceAnswer);
   if(index===question.correct)option.classList.add("correct");
   else if(option===button)option.classList.add("incorrect");
  }
  resetFeedback(scienceFeedback,(correct?"Exactly! ":"Good attempt. ")+question.explain);
  scienceFeedback.classList.add(correct?"correct":"incorrect");
 });
 byId("practiceNextScience")?.addEventListener("click",nextScience);
 nextMath();
 nextScience();
})();