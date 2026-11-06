/* Lightweight chess opponent for Lightning's server-side chess.js games.
 * Difficulty changes the search, not just an on-screen label.
 * The engine always plays a chess.js-validated move.
 */
export const CHESS_LEVELS=["easy","normal","hard","expert"];
const PIECE_VALUE={p:100,n:315,b:335,r:505,q:940,k:0};
const PIECE_IMPORTANCE={p:1,n:3,b:3,r:5,q:9,k:0};
const orderScore=move=>
 (move.captured?(PIECE_VALUE[move.captured]-PIECE_VALUE[move.piece]/12+350):0)+
 (move.promotion?PIECE_VALUE[move.promotion]+300:0)+
 (move.san.endsWith("#")?12000:move.san.endsWith("+")?110:0)+
 (3.5-Math.abs(3.5-"abcdefgh".indexOf(move.to[0])))*4;
function evaluate(chess){
 const board=chess.board();
 let score=0;
 for(let rank=0;rank<8;rank++)for(let file=0;file<8;file++){
  const piece=board[rank][file];
  if(!piece)continue;
  const center=(3.5-Math.abs(file-3.5))+(3.5-Math.abs(rank-3.5));
  const advancement=piece.color==="w"?6-rank:rank-1;
  const activity=piece.type==="p"?advancement*4+center*2:
   ["n","b"].includes(piece.type)?center*6:
   piece.type==="q"?center*2:piece.type==="k"?-center*2:center;
  score+=(PIECE_VALUE[piece.type]+activity)*(piece.color==="w"?1:-1);
 }
 return score*(chess.turn()==="w"?1:-1);
}
function search(chess,depth,alpha,beta,budget,ply=0){
 if(chess.isCheckmate())return -100000+ply;
 if(chess.isDraw())return 0;
 if(depth===0||budget.nodes++>=budget.limit||Date.now()>budget.deadline)
  return evaluate(chess);
 const moves=chess.moves({verbose:true}).sort((a,b)=>orderScore(b)-orderScore(a));
 let best=-Infinity;
 // Keep the deeper levels responsive even in tactical middlegames.
 for(const move of moves.slice(0,depth>=2?20:16)){
  chess.move(move);
  const value=-search(chess,depth-1,-beta,-alpha,budget,ply+1);
  chess.undo();
  best=Math.max(best,value);
  alpha=Math.max(alpha,value);
  if(alpha>=beta||budget.nodes>=budget.limit||Date.now()>budget.deadline)break;
 }
 return best===-Infinity?evaluate(chess):best;
}
export function chooseChessMove(chess,level="normal"){
 if(!CHESS_LEVELS.includes(level))level="normal";
 const options=chess.moves({verbose:true});
 if(!options.length)return null;
 if(level==="easy")return options[Math.floor(Math.random()*options.length)];
 const depth={normal:1,hard:2,expert:3}[level];
 const budget={
  nodes:0,limit:level==="expert"?2200:level==="hard"?700:160,
  deadline:Date.now()+(level==="expert"?360:level==="hard"?210:110)
 };
 const ordered=options.slice().sort((a,b)=>orderScore(b)-orderScore(a));
 let bestMove=ordered[0],bestScore=-Infinity,alpha=-Infinity;
 for(const move of ordered){
  chess.move(move);
  const score=-search(chess,depth-1,-Infinity,-alpha,budget,1);
  chess.undo();
  const fuzz=level==="normal"?(Math.random()-.5)*90:
   level==="hard"?(Math.random()-.5)*14:0;
  if(score+fuzz>bestScore){bestScore=score+fuzz;bestMove=move;}
  alpha=Math.max(alpha,score);
  if(budget.nodes>=budget.limit||Date.now()>budget.deadline)break;
 }
 return bestMove;
}
