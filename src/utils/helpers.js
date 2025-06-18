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

export {
  cloneBoard,
  deepClone,
  isWhitePiece,
  isBlackPiece,
  isEnemyPiece,
  isSameTeam,
};