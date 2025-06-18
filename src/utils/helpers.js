import {
    WHITE_PIECES,
    BLACK_PIECES,
} from '../constants/pieces.js';

// General utility helpers reused across the app

const isWhitePiece = (p) => WHITE_PIECES.includes(p);
const isBlackPiece = (p) => BLACK_PIECES.includes(p);
const isEnemyPiece = (p, isWhite) => (isWhite ? isBlackPiece(p) : isWhitePiece(p));
const isSameTeam = (p1, p2) =>
  (isWhitePiece(p1) && isWhitePiece(p2)) || (isBlackPiece(p1) && isBlackPiece(p2));

// Shallow clone used when we want a new board reference
const cloneBoard = (board) => board.map((r) => [...r]);

// Utility to deep clone objects (used for history snapshots)
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

// Serialize board position plus turn/castling/en passant to detect repetitions
function boardKey(board, turn, castlingRights, enPassantTarget) {
  const map = {
    '♙': 'P',
    '♟': 'p',
    '♘': 'N',
    '♞': 'n',
    '♖': 'R',
    '♜': 'r',
    '♗': 'B',
    '♝': 'b',
    '♕': 'Q',
    '♛': 'q',
    '♔': 'K',
    '♚': 'k',
  };
  const rows = board.map((row) => {
    let str = '';
    let empty = 0;
    for (const piece of row) {
      if (piece === '') {
        empty += 1;
      } else {
        if (empty > 0) {
          str += empty;
          empty = 0;
        }
        str += map[piece] || piece;
      }
    }
    if (empty > 0) str += empty;
    return str;
  });
  const boardStr = rows.join('/');
  const rights = [
    castlingRights.white.kingSide ? 'K' : '',
    castlingRights.white.queenSide ? 'Q' : '',
    castlingRights.black.kingSide ? 'k' : '',
    castlingRights.black.queenSide ? 'q' : '',
  ]
    .join('') || '-';
  const ep = enPassantTarget
    ? String.fromCharCode(97 + enPassantTarget.col) + (8 - enPassantTarget.row)
    : '-';
  const turnChar = turn === 'white' ? 'w' : 'b';
  return `${boardStr} ${turnChar} ${rights} ${ep}`;
}

export {
  cloneBoard,
  deepClone,
  isWhitePiece,
  isBlackPiece,
  isEnemyPiece,
  isSameTeam,
  boardKey,
};