import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Chess} from "chess.js";
import {chooseChessMove,CHESS_LEVELS} from "../chess-ai.js";

test("All four chess difficulties make legal moves without mutating the board",()=>{
 for(const level of CHESS_LEVELS){
  const board=new Chess(),before=board.fen();
  const legal=new Set(board.moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||"")));
  const move=chooseChessMove(board,level);
  assert.ok(move,level+" must select a move");
  assert.ok(legal.has(move.from+move.to+(move.promotion||"")),level+" selected an illegal move");
  assert.equal(board.fen(),before,level+" changed the board during analysis");
 }
 assert.deepEqual(CHESS_LEVELS,["easy","normal","hard","expert"]);
});

test("Expert chess AI recognizes and plays a forced checkmate in one",()=>{
 const board=new Chess("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2");
 const move=chooseChessMove(board,"expert");
 assert.ok(move);
 assert.equal(move.from+move.to,"d8h4","Expert should find Qh4#");
 board.move(move);
 assert.equal(board.isCheckmate(),true);
});

test("Finished games are not given a phantom move",()=>{
 const board=new Chess();
 for(const san of ["f3","e5","g4","Qh4#"])board.move(san);
 assert.equal(chooseChessMove(board,"hard"),null);
});

test("Compact screens keep the board and scroll containers mounted",()=>{
 const chess=readFileSync(new URL("../public/assets/chess-visuals.js",import.meta.url),"utf8");
 const rps=readFileSync(new URL("../public/assets/rps-visuals.js",import.meta.url),"utf8");
 const style=readFileSync(new URL("../public/assets/compact-games.css",import.meta.url),"utf8");
 const hub=readFileSync(new URL("../public/assets/hub.js",import.meta.url),"utf8");
 const live=readFileSync(new URL("../live.js",import.meta.url),"utf8");
 for(const item of ["chessDifficulty","chess-v2-side","chess-compact-match",
  "oldBoard.innerHTML","focus({preventScroll:true})","chessSecret","Shift + G"])
  assert.ok(chess.includes(item),item+" is missing");
 assert.match(chess,/existing\?\.dataset\.matchId===game\.id/);
 assert.match(chess,/chessAutoToggle/);
 assert.match(rps,/oldScroll/);
 assert.match(rps,/current\.scrollTop=oldScroll/);
 assert.match(style,/--compact-board/);
 assert.match(style,/\.rps-rewrite \.rps-duel-stage/);
 assert.match(style,/\.rps-rewrite \.rps-round-actions/);
 assert.match(hub,/chessBot",difficulty/);
 assert.match(live,/function chessAutoplay/);
 assert.match(live,/autoPlayers\.has\(u\.id\)/);
 assert.doesNotThrow(()=>new Function(chess.replace("export function installChessVisuals","function installChessVisuals")));
 assert.doesNotThrow(()=>new Function(rps.replace("export function installRpsVisuals","function installRpsVisuals")));
});
