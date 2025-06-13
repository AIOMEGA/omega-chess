import { useState, useEffect, useRef } from 'react';
import './App.css';
import './assets/logo.png'

// Unicode pieces (♙♘♗♖♕♔ / ♟♞♝♜♛♚)
// Starting layout for a new game
const initialBoard = [
  ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
  ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
  [ '',  '',  '',  '',  '',  '',  '',  ''],
  [ '',  '',  '',  '',  '',  '',  '',  ''],
  [ '',  '',  '',  '',  '',  '',  '',  ''],
  [ '',  '',  '',  '',  '',  '',  '',  ''],
  ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
  ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
];

// Map each Unicode piece to its SVG image file. Assets sourced from https://github.com/lichess-org/lila/tree/master/public/piece
const pieceImages = {
  '♙': 'wP.svg',
  '♟': 'bP.svg',
  '♘': 'wN.svg',
  '♞': 'bN.svg',
  '♖': 'wR.svg',
  '♜': 'bR.svg',
  '♗': 'wB.svg',
  '♝': 'bB.svg',
  '♕': 'wQ.svg',
  '♛': 'bQ.svg',
  '♔': 'wK.svg',
  '♚': 'bK.svg',
};

// Lists of piece symbols to quickly determine piece color
const WHITE_PIECES = ['♙', '♘', '♗', '♖', '♕', '♔'];
const BLACK_PIECES = ['♟', '♞', '♝', '♜', '♛', '♚'];

// Utility helpers reused across the app
const isWhitePiece = (p) => WHITE_PIECES.includes(p);
const isBlackPiece = (p) => BLACK_PIECES.includes(p);
const isEnemyPiece = (p, isWhite) =>
  isWhite ? isBlackPiece(p) : isWhitePiece(p);
const isSameTeam = (p1, p2) =>
  (isWhitePiece(p1) && isWhitePiece(p2)) ||
  (isBlackPiece(p1) && isBlackPiece(p2));

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

function getValidPawnMoves(board, row, col, piece, enPassantTarget) {
  const isWhite = piece === '♙';

  const validMoves = [];

  const forward = isWhite ? -1 : 1;
  const startRow = isWhite ? 6 : 1;

  // All 8 directions
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1],
  ];

  for (let [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) continue;

    const target = board[newRow][newCol];

    const isDiagonal = Math.abs(dr) === 1 && Math.abs(dc) === 1;

    if (target === '') {
      // Empty square — allow in any direction
      validMoves.push([newRow, newCol]);
    } else if (isDiagonal && isEnemyPiece(target, isWhite)) {
      // Capture diagonally only
      validMoves.push([newRow, newCol]);
    }
  }

  // 2-square forward move if not blocked
  const oneStep = row + forward;
  const twoStep = row + 2 * forward;
  if (row === startRow &&
      board[oneStep]?.[col] === '' &&
      board[twoStep]?.[col] === '') {
    validMoves.push([twoStep, col]);
  }

  // En passant
  for (let dc of [-1, 1]) {
    const newRow = row + forward;
    const newCol = col + dc;
    if (enPassantTarget &&
        enPassantTarget.row === newRow &&
        enPassantTarget.col === newCol) {
      validMoves.push([newRow, newCol]);
    }
  }

  return validMoves;
}

// Rook movement for Omega chess. Allows normal rook moves and a special
// 'hop over one piece' mechanic implemented via blockerFound logic.
function getValidRookMoves(board, row, col, piece) {
  const isWhite = piece === '♖';

  const validMoves = [];
  const directions = [
    [-1, 0], // up
    [1, 0],  // down
    [0, -1], // left
    [0, 1],  // right
  ];

  for (const [dr, dc] of directions) {
    let r = row + dr;
    let c = col + dc;
    let blockerFound = false;

    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const target = board[r][c];

      if (!blockerFound) {
        if (target === '') {
          validMoves.push([r, c]); // normal movement
        } else {
          if (isEnemyPiece(target, isWhite)) {
            validMoves.push([r, c]); // capture the blocker
          }

          blockerFound = true; // now check one square past
        }
      } else {
        const behindPiece = board[r][c];
        if (behindPiece === '' || isEnemyPiece(behindPiece, isWhite)) {
          validMoves.push([r, c]); // jump move: land only directly behind
        }

        break; // only allowed to hop 1 piece
      }

      r += dr;
      c += dc;
    }
  }

  return validMoves;
}

// Queen movement expands the normal Rook + Bishop movement to the Omega Chess "line of sight" logic
// which uses pixel based ray tracing to see any tile on the board so long as it's not blocked by another piece.
function getValidQueenMoves(board, row, col, piece) {
  const isWhite = piece === '♕';

  const validMoves = [];

  const isEnemy = (target) => isEnemyPiece(target, isWhite);

  // Ray cast across SVG board to check that no piece lies between
  // the queen and target square when using sliding moves.
  function hasLineOfSight(toRow, toCol) {
    const squareSize = 105;
  
    const startX = col * squareSize + 52.5 + 4;
    const startY = row * squareSize + 52.5 + 4;
    const endX = toCol * squareSize + 52.5 + 4;
    const endY = toRow * squareSize + 52.5 + 4;
  
    const dx = endX - startX;
    const dy = endY - startY;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 48); // higher = smoother
  
    let prevTile = null;
  
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = startX + dx * t;
      const y = startY + dy * t;
  
      const tileRow = Math.floor(y / squareSize);
      const tileCol = Math.floor(x / squareSize);
      const tileId = `${tileRow}-${tileCol}`;
  
      if (
        tileId !== prevTile &&
        !(tileRow === row && tileCol === col) &&
        !(tileRow === toRow && tileCol === toCol)
      ) {
        if (board[tileRow]?.[tileCol] !== '') return false;
      }
  
      prevTile = tileId;
    }
  
    return true;
  }
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (r === row && c === col) continue;

      if (hasLineOfSight(r, c)) {
        const target = board[r][c];
        if (target === '' || isEnemy(target)) {
          validMoves.push([r, c]);
        }
      }
    }
  }

  return validMoves;
}

// Knight moves use a 5x5 mask that avoids the centre "3x3" area, creating
// the extended omnidirectional movement of Omega chess knights.
function getValidKnightMoves(board, row, col, piece) {
  const isWhite = piece === '♘';

  const validMoves = [];

  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue; // skip current square
      if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) continue; // skip 3x3 core

      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;

      const target = board[r][c];
      if (target === '') {
        validMoves.push([r, c]);
      } else if (isEnemyPiece(target, isWhite)) {
        validMoves.push([r, c]);
      }
    }
  }

  return validMoves;
}

// Bishop moves combine standard diagonals with a one-step king-like move in
// any direction, no more exclusively light or dark square bishops as now they can be both.
function getValidBishopMoves(board, row, col, piece) {
  const isWhite = piece === '♗';

  const validMoves = [];

  const isEnemy = (target) => isEnemyPiece(target, isWhite);

  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1],
  ];

  // Bishop-style infinite diagonals (4 directions only)
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const target = board[r][c];
      if (target === '') {
        validMoves.push([r, c]);
      } else {
        if (isEnemy(target)) validMoves.push([r, c]);
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // King-style 1-tile in any direction (orthogonal + diagonal)
  for (const [dr, dc] of directions) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const target = board[r][c];
      if (target === '' || isEnemy(target)) {
        validMoves.push([r, c]);
      }
    }
  }

  return validMoves;
}

// Utility used for check detection. It scans all opposing pieces and asks each
// piece's move generator if it could capture the target square.
function isSquareAttacked(board, row, col, attackerIsWhite) {
  const isEnemy = (piece) =>
    attackerIsWhite ? isWhitePiece(piece) : isBlackPiece(piece);

  // Helper to reuse your move checkers (just reuse your logic here!)
  const getAllEnemyMoves = (r, c, piece) => {
    if (piece === '♙' || piece === '♟') return getValidPawnMoves(board, r, c, piece);
    if (piece === '♘' || piece === '♞') return getValidKnightMoves(board, r, c, piece);
    if (piece === '♗' || piece === '♝') return getValidBishopMoves(board, r, c, piece);
    if (piece === '♖' || piece === '♜') return getValidRookMoves(board, r, c, piece);
    if (piece === '♕' || piece === '♛') return getValidQueenMoves(board, r, c, piece);
    if (piece === '♔' || piece === '♚') return [];
    return [];
  };
  

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!isEnemy(piece)) continue;

      const moves = getAllEnemyMoves(r, c, piece);
      for (const [mr, mc] of moves) {
        if (mr === row && mc === col) return true;
      }
    }
  }

  return false;
}

// Returns the positions of any pieces checking the king of the given color
function getCheckingPieces(board, color) {
  const kingPos = findKingPosition(board, color === 'black');
  if (!kingPos) return null;

  const attackerIsWhite = color === 'black';
  const attackers = [];

  const isEnemy = (piece) =>
    attackerIsWhite ? isWhitePiece(piece) : isBlackPiece(piece);

  const getAllEnemyMoves = (r, c, piece) => {
    if (piece === '♙' || piece === '♟') return getValidPawnMoves(board, r, c, piece, null);
    if (piece === '♘' || piece === '♞') return getValidKnightMoves(board, r, c, piece);
    if (piece === '♗' || piece === '♝') return getValidBishopMoves(board, r, c, piece);
    if (piece === '♖' || piece === '♜') return getValidRookMoves(board, r, c, piece);
    if (piece === '♕' || piece === '♛') return getValidQueenMoves(board, r, c, piece);
    if (piece === '♔' || piece === '♚') return [];
    return [];
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!isEnemy(piece)) continue;

      const moves = getAllEnemyMoves(r, c, piece);
      for (const [mr, mc] of moves) {
        if (mr === kingPos.row && mc === kingPos.col) {
          attackers.push({ row: r, col: c });
          break;
        }
      }
    }
  }

  if (attackers.length === 0) return null;
  return { king: kingPos, attackers };
}

// Helper used for check logic to locate a specific colour king on the board.
function findKingPosition(board, isWhite) {
  const kingSymbol = isWhite ? '♚' : '♔'; // enemy king
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === kingSymbol) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

// Wrapper around isSquareAttacked that first finds the king of the given color
// and determines if any opposing piece can attack that square.
function isKingInCheck(board, color) {
  const kingPos = findKingPosition(board, color === 'black');
  if (!kingPos) return false;
  return isSquareAttacked(
    board,
    kingPos.row,
    kingPos.col,
    color === 'black'
  );
}

// Helper used when checking move legality. It plays a move on a cloned board
// and returns the resulting board state. Handles en passant captures.
function simulateMove(board, fromRow, fromCol, toRow, toCol, piece, enPassantTarget) {
  const newBoard = cloneBoard(board);

  if (
    (piece === '♙' || piece === '♟') &&
    enPassantTarget &&
    toRow === enPassantTarget.row &&
    toCol === enPassantTarget.col &&
    board[toRow][toCol] === ''
  ) {
    const captureRow = fromRow;
    newBoard[captureRow][toCol] = '';
  }

  newBoard[toRow][toCol] = piece;
  newBoard[fromRow][fromCol] = '';
  return newBoard;
}

// After generating pseudo-legal moves we simulate each one to ensure the
// current player's king would not remain in check. Castling moves are
// handled specially here as well.
function filterLegalMoves(moves, board, fromRow, fromCol, piece, enPassantTarget) {
  const color = WHITE_PIECES.includes(piece) ? 'white' : 'black';
  const legal = [];
  for (const move of moves) {
    if (!Array.isArray(move)) {
      legal.push(move);
      continue;
    }
    if (typeof move[0] !== 'number' || typeof move[1] !== 'number') {
      // e.g. ['summon', row, col] -- special moves that don't require simulation
      legal.push(move);
      continue;
    }
    const [r, c] = move;
    let newBoard;
    if ((piece === '♔' || piece === '♚') && Math.abs(c - fromCol) === 2 && r === fromRow) {
      const isWhite = piece === '♔';
      const kingSide = c > fromCol;
      const rookFromCol = kingSide ? 7 : 0;
      const rookToCol = kingSide ? c - 1 : c + 1;
      newBoard = cloneBoard(board);
      newBoard[fromRow][fromCol] = '';
      newBoard[r][c] = piece;
      newBoard[fromRow][rookFromCol] = '';
      newBoard[fromRow][rookToCol] = isWhite ? '♖' : '♜';
    } else {
      newBoard = simulateMove(board, fromRow, fromCol, r, c, piece, enPassantTarget);
    }
    if (!isKingInCheck(newBoard, color)) legal.push(move);
  }
  return legal;
}

// Iterates all pieces of a given color and checks if at least one legal move
// exists. Used for stalemate/checkmate detection.
function hasAnyLegalMoves(board, color, kingState, enPassantTarget, castlingRights) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (color === 'white' && !WHITE_PIECES.includes(piece)) continue;
      if (color === 'black' && !BLACK_PIECES.includes(piece)) continue;

      let moves = [];
      if (piece === '♙' || piece === '♟')
        moves = getValidPawnMoves(board, r, c, piece, enPassantTarget);
      else if (piece === '♖' || piece === '♜')
        moves = getValidRookMoves(board, r, c, piece);
      else if (piece === '♕' || piece === '♛')
        moves = getValidQueenMoves(board, r, c, piece);
      else if (piece === '♘' || piece === '♞')
        moves = getValidKnightMoves(board, r, c, piece);
      else if (piece === '♗' || piece === '♝')
        moves = getValidBishopMoves(board, r, c, piece);
      else if (piece === '♔' || piece === '♚')
        moves = getValidKingMoves(board, r, c, piece, kingState[color], castlingRights);

      const legal = filterLegalMoves(moves, board, r, c, piece, enPassantTarget);
      if (legal.length > 0) return true;
    }
  }
  return false;
}

// Main king move generator. Handles normal one-square movement while ensuring
// the king doesn't move into check, includes custom summoning logic and checks
// whether castling is available.
function getValidKingMoves(board, row, col, piece, kingState, castlingRights) {
  const isWhite = piece === '♔';
  const isEnemy = (target) => isEnemyPiece(target, isWhite);

  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1],
  ];

  const validMoves = [];

  for (const [dr, dc] of directions) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;

    const target = board[r][c];
    if (target === '' || isEnemy(target)) {
      // Simulate the move
      const simulatedBoard = cloneBoard(board);
      simulatedBoard[row][col] = ''; // Clear old king position
      simulatedBoard[r][c] = piece; // Move king to new position
    
      const wouldBeInCheck = isSquareAttacked(simulatedBoard, r, c, !isWhite);

      const enemyKingPos = findKingPosition(board, isWhite);
      const tooCloseToEnemyKing =
        enemyKingPos &&
        Math.abs(enemyKingPos.row - r) <= 1 &&
        Math.abs(enemyKingPos.col - c) <= 1;

      if (!wouldBeInCheck && !tooCloseToEnemyKing) {
        validMoves.push([r, c]);
      }
    }
    
  }

  // Summoning check
  const enemyRow = isWhite ? 0 : 7;

  const canSummon =
    row === enemyRow &&
    !kingState.hasSummoned &&
    (!kingState.needsReturn || kingState.returnedHome);

  if (canSummon) {
    for (const offset of [-1, 1]) {
      const c = col + offset;
      if (c >= 0 && c < 8 && board[row][c] === '') {
        validMoves.push(['summon', row, c]); // Special indicator
      }
    }
  }

  // --- Castling ---
  const color = isWhite ? 'white' : 'black';
  const rights = castlingRights?.[color];
  const homeRow = isWhite ? 7 : 0;

  // Ensure king is on its original square
  if (row === homeRow && col === 4 && rights) {
    // Kingside
    if (
      rights.kingSide &&
      board[homeRow][5] === '' &&
      board[homeRow][6] === '' &&
      !isSquareAttacked(board, homeRow, 4, !isWhite) &&
      !isSquareAttacked(board, homeRow, 5, !isWhite) &&
      !isSquareAttacked(board, homeRow, 6, !isWhite)
    ) {
      validMoves.push([homeRow, 6]);
    }

    // Queenside
    if (
      rights.queenSide &&
      board[homeRow][3] === '' &&
      board[homeRow][2] === '' &&
      board[homeRow][1] === '' &&
      !isSquareAttacked(board, homeRow, 4, !isWhite) &&
      !isSquareAttacked(board, homeRow, 3, !isWhite) &&
      !isSquareAttacked(board, homeRow, 2, !isWhite)
    ) {
      validMoves.push([homeRow, 2]);
    }
  }

  return validMoves;
}

// Places a new piece next to the enemy back rank king as part of the king's
// summoning ability. Returns a cloned board with the piece added.
function performSummon(board, row, col, color, pieceType = '♕') {
  const newBoard = cloneBoard(board);
  newBoard[row][col] = pieceType;
  return newBoard;
}

// Handles pawn promotion. Removes the pawn from its original square and places
// the chosen piece on the target square.
function performPromotion(board, row, col, fromRow, fromCol, color, piece) {
  const newBoard = deepClone(board);
  newBoard[fromRow][fromCol] = '';
  newBoard[row][col] = piece;
  return newBoard;
}

function App() {
  // Current board state as an 8x8 array of piece symbols
  const [board, setBoard] = useState(initialBoard);
  // Currently selected square {row, col} or null
  const [selected, setSelected] = useState(null);
  // If a pawn advanced two squares last move this holds the square that can be captured en passant
  const [enPassantTarget, setEnPassantTarget] = useState(null); // e.g. { row: 3, col: 4 }
  // Tracks each king's special summoning status
  const [kingState, setKingState] = useState({
    white: { hasSummoned: false, needsReturn: false, returnedHome: false },
    black: { hasSummoned: false, needsReturn: false, returnedHome: false },
  });
  // When a king reaches the back rank we show summoning UI using this state
  const [summonOptions, setSummonOptions] = useState(null); // e.g., { row: 0, col: 4, color: 'black' }
  // UI state for pawn promotion menu
  const [promotionOptions, setPromotionOptions] = useState(null); // { row, col, color, fromRow, fromCol }
  // Track whether each side may still castle on either side
  const [castlingRights, setCastlingRights] = useState({
    white: { kingSide: true, queenSide: true },
    black: { kingSide: true, queenSide: true },
  });
  // Remember the last king move to support canceling summons
  const [lastKingMove, setLastKingMove] = useState(null); // { fromRow, fromCol, toRow, toCol }
  // Whose turn it is to move
  const [turn, setTurn] = useState('white');
  // Array of past moves used for undo/redo functionality
  const [moveHistory, setMoveHistory] = useState([]);
  // Index pointer into moveHistory for current view
  const [historyIndex, setHistoryIndex] = useState(-1); // index of current move
  // Display helper text such as "check" notices
  const [statusMessage, setStatusMessage] = useState('');
  // Holds winner color when checkmate occurs
  const [checkmateInfo, setCheckmateInfo] = useState(null); // { winner: 'white'|'black' }

  // Information when a draw is reached
  const [drawInfo, setDrawInfo] = useState(null); // { type, message }
  // Winner color when a resignation happens
  const [resignInfo, setResignInfo] = useState(null); // { winner: 'white'|'black' }
  // Counts half-moves since the last capture or pawn move
  const [, setHalfmoveClock] = useState(0); // half-move counter for fifty-move rule
  // Track occurrences of board positions for repetition detection
  const positionCountsRef = useRef({});
  // Persistent board annotations (circles, arrows, lines)
  const [annotations, setAnnotations] = useState([]);
  // Ref to board container for coordinate calculations
  const boardRef = useRef(null);
  // Ref tracking right-click drag state
  const rightDragRef = useRef({ dragging: false });

  const bcRef = useRef(null);
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));
  const suppressRef = useRef(false);
  const recordMoveRef = useRef(null); // holds latest recordMove implementation
  const modeRef = useRef('play');
  const [reviewMode, setReviewMode] = useState(false); // true when viewing past moves
  const reviewModeRef = useRef(false); // latest review mode state
  const moveHistoryRef = useRef([]); // latest moveHistory for remote handlers
  const historyIndexRef = useRef(-1); // latest historyIndex
  const remoteUndoRef = useRef(null); // latest remote undo handler

  const squareSize = 105;
  const boardOffset = 4; // matches board border

  const toDisplayCoords = (row, col) =>
    playerColor === 'white'
      ? { row, col }
      : { row: 7 - row, col: 7 - col };
  const fromDisplayCoords = (row, col) =>
    playerColor === 'white'
      ? { row, col }
      : { row: 7 - row, col: 7 - col };

  const coordLabel = (row, col) => {
    return `${String.fromCharCode(97 + col)}${8 - row}`;
  };

  const overlayTop = (row) => {
    const dispRow = toDisplayCoords(row, 0).row;
    return dispRow <= 3 ? dispRow * squareSize : dispRow * squareSize - 315;
  };

  const getSquareFromEvent = (e) => {
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - boardOffset;
    const y = e.clientY - rect.top - boardOffset;
    const displayCol = Math.floor(x / squareSize);
    const displayRow = Math.floor(y / squareSize);
    if (displayCol < 0 || displayCol > 7 || displayRow < 0 || displayRow > 7)
      return null;
    return fromDisplayCoords(displayRow, displayCol);
  };

  const toggleAnnotation = (ann) => {
    setAnnotations((prev) => {
      const match = prev.findIndex((a) => {
        if (a.type !== ann.type) return false;
        if (ann.type === 'circle') {
          return a.row === ann.row && a.col === ann.col;
        }
        return (
          a.from.row === ann.from.row &&
          a.from.col === ann.from.col &&
          a.to.row === ann.to.row &&
          a.to.col === ann.to.col
        );
      });
      if (match !== -1) {
        const copy = prev.slice();
        copy.splice(match, 1);
        // console.debug('Removed annotation', ann);
        return copy;
      }
      // console.debug('Added annotation', ann);
      return [...prev, ann];
    });
  };

  const handleBoardMouseDown = (e) => {
    if (e.button !== 2) return;
    e.preventDefault();
    const sq = getSquareFromEvent(e);
    if (!sq) return;
    rightDragRef.current = { dragging: true, start: sq, shift: e.shiftKey };
    // console.debug('Right mouse down', { square: sq, shift: e.shiftKey });
  };

  const handleBoardMouseUp = (e) => {
    if (e.button !== 2) return;
    e.preventDefault();
    const data = rightDragRef.current;
    if (!data.dragging) return;
    const sq = getSquareFromEvent(e);
    if (!sq) {
      rightDragRef.current.dragging = false;
      return;
    }
    if (data.start.row === sq.row && data.start.col === sq.col) {
      // console.debug('Toggle circle', sq);
      toggleAnnotation({ type: 'circle', row: sq.row, col: sq.col });
    } else if (data.shift) {
      // console.debug('Toggle line', { from: data.start, to: sq });
      toggleAnnotation({ type: 'line', from: data.start, to: sq });
    } else {
      // console.debug('Toggle arrow', { from: data.start, to: sq });
      toggleAnnotation({ type: 'arrow', from: data.start, to: sq });
    }
    rightDragRef.current.dragging = false;
  };
  
  // --- Analysis mode ---
  const [playerColor, setPlayerColor] = useState('white');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlColor = params.get('color');
    if (urlColor === 'white' || urlColor === 'black') {
      setPlayerColor(urlColor);
      localStorage.setItem('playerColor', urlColor);
      return;
    }
    const stored = localStorage.getItem('playerColor');
    if (stored === 'white' || stored === 'black') {
      setPlayerColor(stored);
      return;
    }
    const random = Math.random() < 0.5 ? 'white' : 'black';
    setPlayerColor(random);
    localStorage.setItem('playerColor', random);
  }, []);
  const [mode, setMode] = useState('play'); // 'play' or 'analysis'
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [analysisIndex, setAnalysisIndex] = useState(-1);
  const analysisSavedRef = useRef(null);

  const activateAnalysis = (sel) => {
    if (mode === 'analysis') return;
    analysisSavedRef.current = {
      board: cloneBoard(board),
      turn,
      kingState: deepClone(kingState),
      enPassantTarget,
      castlingRights: deepClone(castlingRights),
      lastKingMove,
    };
    setBoard(cloneBoard(board));
    setKingState(deepClone(kingState));
    setCastlingRights(deepClone(castlingRights));
    setEnPassantTarget(enPassantTarget ? { ...enPassantTarget } : null);
    setLastKingMove(lastKingMove ? { ...lastKingMove } : null);
    setMode('analysis');
    setAnalysisHistory([]);
    setAnalysisIndex(-1);
    setSelected(sel);
  };

  const deactivateAnalysis = () => {
    if (mode !== 'analysis') return;
    const saved = analysisSavedRef.current;
    if (saved) {
      setBoard(saved.board);
      setTurn(saved.turn);
      setKingState(deepClone(saved.kingState));
      setCastlingRights(deepClone(saved.castlingRights));
      setEnPassantTarget(saved.enPassantTarget || null);
      setLastKingMove(saved.lastKingMove || null);
    }
    setMode('play');
    setAnalysisHistory([]);
    setAnalysisIndex(-1);
    setSelected(null);
  };

  // Exit analysis without restoring the saved position. Used when
  // a remote move occurs while the user is in analysis mode so we
  // can return to play mode and keep the incoming board state.
  const forceExitAnalysis = () => {
    if (mode !== 'analysis') return;
    setMode('play');
    setAnalysisHistory([]);
    setAnalysisIndex(-1);
    setSelected(null);
    analysisSavedRef.current = null;
  };
  
  useEffect(() => {
    const key = boardKey(
      initialBoard,
      'white',
      { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } },
      null
    );
    positionCountsRef.current = { [key]: 1 };
    // console.log('boardKey', key, 'count', 1);
  }, []);

  // Helper to push a move onto the history stack. If we have undone moves,
  // they are sliced off before the new move is appended.
  const recordMove = (move, forcePlay = false) => {
    if (mode === 'analysis' && !forcePlay) {
      const newHistory = analysisHistory.slice(0, analysisIndex + 1);
      newHistory.push(move);
      setAnalysisHistory(newHistory);
      setAnalysisIndex(newHistory.length - 1);
      return;
    }
    const newHistory = moveHistory.slice(0, historyIndex + 1);
    newHistory.push(move);
    setMoveHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    if (!suppressRef.current) {
      bcRef.current?.postMessage({ type: 'move', move, senderId: instanceIdRef.current });
    }

    if (mode !== 'analysis' || forcePlay) {
      const isPawnMove = move.piece === '♙' || move.piece === '♟';
      const isCapture = !!move.captured;
      setHalfmoveClock((hc) => {
        const newClock = isPawnMove || isCapture ? 0 : hc + 1;
        if (newClock >= 100) {
          setDrawInfo({ type: 'fifty', message: 'Draw by fifty-move rule.' });
        }
        return newClock;
      });

      const key = boardKey(
        move.board,
        move.turn === 'white' ? 'black' : 'white',
        move.castlingRights,
        move.enPassantTarget
      );
      const counts = positionCountsRef.current;
      const count = (counts[key] || 0) + 1;
      counts[key] = count;
      // console.log('boardKey', key, 'count', count);
      if (count >= 3) {
        setDrawInfo({ type: 'threefold', message: 'Draw by threefold repetition.' });
      }
    }
  };

  // Keep a ref to the latest recordMove so BroadcastChannel handler
  // always invokes the current logic even though it was bound once
  useEffect(() => {
    recordMoveRef.current = recordMove;
  });

  // Keep current mode available for BroadcastChannel listeners
  useEffect(() => {
    modeRef.current = mode;
  });

  // --- Hooks ---
  // Ref so we can auto-scroll the move list when new moves are added
  const moveListRef = useRef(null);
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [historyIndex, analysisIndex, mode]);

  // Watch board/turn changes to show check/checkmate/draw messages
  useEffect(() => {
    if (mode === 'analysis') {
      setCheckmateInfo(null);
      setDrawInfo(null);
      setStatusMessage('');
      return;
    }
    const inCheck = isKingInCheck(board, turn);
    const hasMoves = hasAnyLegalMoves(board, turn, kingState, enPassantTarget, castlingRights);

    if (inCheck && !hasMoves) {
      setCheckmateInfo({ winner: turn === 'white' ? 'black' : 'white' });
      setStatusMessage('');
      return;
    }
    setCheckmateInfo(null);

    if (!inCheck && !hasMoves) {
      setDrawInfo({ type: 'stalemate', message: 'Draw by stalemate.' });
      return;
    }

    const pieces = board.flat().filter((p) => p !== '');
    const onlyKings = pieces.every((p) => p === '♔' || p === '♚');
    if (onlyKings) {
      setDrawInfo({ type: 'insufficient', message: 'Draw due to insufficient material.' });
    }

    setStatusMessage('');
  }, [board, turn]);

  const undoMove = () => {
    if (mode === 'analysis') {
      if (analysisIndex < 0) return;
      const newIndex = analysisIndex - 1;
      if (newIndex >= 0) {
        const prev = analysisHistory[newIndex];
        setBoard(prev.board);
        setTurn(prev.turn === 'white' ? 'black' : 'white');
        if (prev.kingState) setKingState(deepClone(prev.kingState));
        if (prev.castlingRights) setCastlingRights(deepClone(prev.castlingRights));
        setEnPassantTarget(prev.enPassantTarget || null);
      } else if (analysisSavedRef.current) {
        setBoard(cloneBoard(analysisSavedRef.current.board));
        setTurn(analysisSavedRef.current.turn);
        setKingState(deepClone(analysisSavedRef.current.kingState));
        setCastlingRights(deepClone(analysisSavedRef.current.castlingRights));
        setEnPassantTarget(analysisSavedRef.current.enPassantTarget || null);
      }
      setAnalysisIndex(newIndex);
      return;
    }

    if (historyIndex < 0) return;
    const isOwnLast =
      historyIndex === moveHistory.length - 1 &&
      moveHistory[historyIndex].turn === playerColor;
    const newIndex = historyIndex - 1;
  
    if (newIndex >= 0) {
      const prev = moveHistory[newIndex];
      setBoard(prev.board);
      setTurn(prev.turn === 'white' ? 'black' : 'white');
      if (prev.kingState) {
        setKingState(deepClone(prev.kingState));
      }
      if (prev.castlingRights) {
        setCastlingRights(deepClone(prev.castlingRights));
      }
      setEnPassantTarget(prev.enPassantTarget || null);
    } else {
      // If going before the first move, reset everything
      setBoard(cloneBoard(initialBoard));
      setTurn('white');
      setKingState({
        white: { hasSummoned: false, needsReturn: false, returnedHome: false },
        black: { hasSummoned: false, needsReturn: false, returnedHome: false },
      });
      setEnPassantTarget(null);
      setCastlingRights({
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true },
      });
    }
  
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;

    if (isOwnLast) {
      setReviewMode(false);
      reviewModeRef.current = false;
    } else {
      setReviewMode(true);
      reviewModeRef.current = true;
    }

    if (isOwnLast) {
      const newHistory = moveHistory.slice(0, -1);
      setMoveHistory(newHistory);
      moveHistoryRef.current = newHistory;
      if (!suppressRef.current) {
        bcRef.current?.postMessage({
          type: 'undo',
          senderId: instanceIdRef.current,
        });
      }
    }
  };
  
  const redoMove = () => {
    if (mode === 'analysis') {
      if (analysisIndex >= analysisHistory.length - 1) return;
      const newIndex = analysisIndex + 1;
      const next = analysisHistory[newIndex];
      setBoard(next.board);
      setTurn(next.turn === 'white' ? 'black' : 'white');
      if (next.kingState) setKingState(deepClone(next.kingState));
      if (next.castlingRights) setCastlingRights(deepClone(next.castlingRights));
      setEnPassantTarget(next.enPassantTarget || null);
      setAnalysisIndex(newIndex);
      return;
    }

    if (historyIndex >= moveHistory.length - 1) return;
    const newIndex = historyIndex + 1;
    const next = moveHistory[newIndex];
    setBoard(next.board);
    setTurn(next.turn === 'white' ? 'black' : 'white');
    if (next.kingState) {
      setKingState(deepClone(next.kingState));
    }
    if (next.castlingRights) {
      setCastlingRights(deepClone(next.castlingRights));
    }
    setEnPassantTarget(next.enPassantTarget || null);
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;

    const reviewing = newIndex < moveHistory.length - 1;
    setReviewMode(reviewing);
    reviewModeRef.current = reviewing;
  };

  const handleRemoteUndo = () => {
    const currentHistory = moveHistoryRef.current;
    if (currentHistory.length === 0) return;

    const newHistory = currentHistory.slice(0, -1);
    const newIndex = newHistory.length - 1;

    setMoveHistory(newHistory);
    moveHistoryRef.current = newHistory;
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;

    if (newIndex >= 0) {
      const prev = newHistory[newIndex];
      setBoard(cloneBoard(prev.board));
      setTurn(prev.turn === 'white' ? 'black' : 'white');
      if (prev.kingState) setKingState(deepClone(prev.kingState));
      if (prev.castlingRights) setCastlingRights(deepClone(prev.castlingRights));
      setEnPassantTarget(prev.enPassantTarget || null);
    } else {
      setBoard(cloneBoard(initialBoard));
      setTurn('white');
      setKingState({
        white: { hasSummoned: false, needsReturn: false, returnedHome: false },
        black: { hasSummoned: false, needsReturn: false, returnedHome: false },
      });
      setEnPassantTarget(null);
      setCastlingRights({
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true },
      });
    }
    setReviewMode(false);
    reviewModeRef.current = false;
  };

  // Keep latest history values for BroadcastChannel handlers
  useEffect(() => {
    moveHistoryRef.current = moveHistory;
    historyIndexRef.current = historyIndex;
    remoteUndoRef.current = handleRemoteUndo;
    reviewModeRef.current = reviewMode;
  });

  const jumpToMove = (index) => {
    if (mode === 'analysis') {
      const move = analysisHistory[index];
      if (move) {
        setBoard(move.board);
        setTurn(move.turn === 'white' ? 'black' : 'white');
        if (move.kingState) setKingState(deepClone(move.kingState));
        if (move.castlingRights) setCastlingRights(deepClone(move.castlingRights));
        setEnPassantTarget(move.enPassantTarget || null);
      } else if (analysisSavedRef.current) {
        setBoard(cloneBoard(analysisSavedRef.current.board));
        setTurn(analysisSavedRef.current.turn);
        setKingState(deepClone(analysisSavedRef.current.kingState));
        setCastlingRights(deepClone(analysisSavedRef.current.castlingRights));
        setEnPassantTarget(analysisSavedRef.current.enPassantTarget || null);
      }
      setAnalysisIndex(index);
      return;
    }
    
    const move = moveHistory[index];
    if (move) {
      setBoard(move.board);
      setTurn(move.turn === 'white' ? 'black' : 'white');
      if (move.kingState) {
        setKingState(deepClone(move.kingState));
      }
      if (move.castlingRights) {
        setCastlingRights(deepClone(move.castlingRights));
      }
      setEnPassantTarget(move.enPassantTarget || null);
    } else {
      setBoard(cloneBoard(initialBoard));
      setTurn('white');
      setKingState({
        white: { hasSummoned: false, needsReturn: false, returnedHome: false },
        black: { hasSummoned: false, needsReturn: false, returnedHome: false },
      });
      setEnPassantTarget(null);
      setCastlingRights({
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true },
      });
    }
    setHistoryIndex(index);
    historyIndexRef.current = index;

    const reviewing = index < moveHistory.length - 1;
    setReviewMode(reviewing);
    reviewModeRef.current = reviewing;
  };
  
  const pieceImagesMap = {
    white: {
      '♕': 'wQ.svg',
      '♘': 'wN.svg',
      '♖': 'wR.svg',
      '♗': 'wB.svg',
    },
    black: {
      '♛': 'bQ.svg',
      '♞': 'bN.svg',
      '♜': 'bR.svg',
      '♝': 'bB.svg',
    }
  };  

  const summonSymbols =
  summonOptions?.color === 'white'
    ? ['♕', '♘', '♖', '♗']
    : ['♛', '♞', '♜', '♝'];

  // --- Highlight helpers ---
  const activeHist = mode === 'analysis' ? analysisHistory : moveHistory;
  const activeIndex = mode === 'analysis' ? analysisIndex : historyIndex;
  const lastMove = activeIndex >= 0 ? activeHist[activeIndex] : null;
  const lastFromKey = lastMove ? `${lastMove.from.row}-${lastMove.from.col}` : null;
  const lastToKey = lastMove ? `${lastMove.to.row}-${lastMove.to.col}` : null;

  const checkSquares = new Set();
  const whiteCheck = getCheckingPieces(board, 'white');
  if (whiteCheck) {
    checkSquares.add(`${whiteCheck.king.row}-${whiteCheck.king.col}`);
    whiteCheck.attackers.forEach(a => checkSquares.add(`${a.row}-${a.col}`));
  }
  const blackCheck = getCheckingPieces(board, 'black');
  if (blackCheck) {
    checkSquares.add(`${blackCheck.king.row}-${blackCheck.king.col}`);
    blackCheck.attackers.forEach(a => checkSquares.add(`${a.row}-${a.col}`));
  }

  // Main click handler for board squares. Handles selecting pieces, moving
  // them, triggering promotions and summoning UIs as well as castling logic.
  const handleClick = (row, col) => {
    const piece = board[row][col];

    if (mode === 'play' && turn !== playerColor && piece !== '' && ((turn === 'white' && isWhitePiece(piece)) || (turn === 'black' && isBlackPiece(piece)))) {
      activateAnalysis({ row, col });
      return;
    }

    // Close open promotion GUIs if open
    if (promotionOptions) {
      setPromotionOptions(null);
      return;
    }

    // Close open summon GUIs if open
    if (summonOptions) {
      // Summon was canceled by clicking the board
      const move = {
        from: lastKingMove
          ? { row: lastKingMove.fromRow, col: lastKingMove.fromCol }
          : { row: summonOptions.row, col: summonOptions.col },
        to: { row: summonOptions.row, col: summonOptions.col },
        piece: summonOptions.color === 'white' ? '♔' : '♚',
        board: cloneBoard(board),
        turn: turn,
        castlingRights: deepClone(castlingRights),
      };

      recordMove(move);
      setSummonOptions(null);
      setLastKingMove(null);
      setTurn(prev => (prev === 'white' ? 'black' : 'white'));
      setSelected(null);
      return; // Exit early to prevent selection re-trigger
    }

    // Clicked selected piece again? Deselect
    if (selected && selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }

    // Selecting a piece
    if (!selected) {
      if (piece !== '') {
        const pieceIsWhite = isWhitePiece(piece);
        if ((turn === 'white' && pieceIsWhite) || (turn === 'black' && !pieceIsWhite)) {
          setSelected({ row, col });
        }
      }
      return;
    }

    const selectedPiece = board[selected.row][selected.col];
    const targetPiece = board[row][col];

    // Prevent capturing own piece
    if (targetPiece && isSameTeam(selectedPiece, targetPiece)) {
      setSelected({ row, col });
      return;
    }

    let validMoves = [];


    // Movement logic

    if (selectedPiece === '♙' || selectedPiece === '♟') {
      validMoves = getValidPawnMoves(board, selected.row, selected.col, selectedPiece, enPassantTarget);
    }
    if (selectedPiece === '♖' || selectedPiece === '♜') {
      validMoves = getValidRookMoves(board, selected.row, selected.col, selectedPiece);
    }
    if (selectedPiece === '♕' || selectedPiece === '♛') {
      validMoves = getValidQueenMoves(board, selected.row, selected.col, selectedPiece);
    }
    if (selectedPiece === '♘' || selectedPiece === '♞') {
      validMoves = getValidKnightMoves(board, selected.row, selected.col, selectedPiece);
    }
    if (selectedPiece === '♗' || selectedPiece === '♝') {
      validMoves = getValidBishopMoves(board, selected.row, selected.col, selectedPiece);
    }
    if (selectedPiece === '♔' || selectedPiece === '♚') {
      const colorKey = selectedPiece === '♔' ? 'white' : 'black';
      validMoves = getValidKingMoves(
        board,
        selected.row,
        selected.col,
        selectedPiece,
        kingState[colorKey],
        castlingRights
      );
    }
    validMoves = filterLegalMoves(validMoves, board, selected.row, selected.col, selectedPiece, enPassantTarget);

    
    const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
    
    if (isValidMove) {
      if (reviewMode) {
        setStatusMessage('Return to the latest move to resume play.');
        setSelected(null);
        return;
      }
      const newBoard = cloneBoard(board);
      const movingPawn = selectedPiece;
    
      const movedPiece = board[selected.row][selected.col];
      const isPawn = movedPiece === '♙' || movedPiece === '♟';
      const targetRow = row;

      const isWhitePromotion = isPawn && movedPiece === '♙' && targetRow === 0;
      const isBlackPromotion = isPawn && movedPiece === '♟' && targetRow === 7;

      // Castling move
      if ((selectedPiece === '♔' || selectedPiece === '♚') && Math.abs(col - selected.col) === 2 && row === selected.row) {
        // Determine castling side and move the rook accordingly
        const isWhite = selectedPiece === '♔';
        const kingSide = col > selected.col;
        const rookFromCol = kingSide ? 7 : 0;
        const rookToCol = kingSide ? col - 1 : col + 1;

        newBoard[row][col] = selectedPiece;
        newBoard[selected.row][selected.col] = '';
        newBoard[row][rookFromCol] = '';
        newBoard[row][rookToCol] = isWhite ? '♖' : '♜';

        const updatedRights = {
          ...castlingRights,
          [isWhite ? 'white' : 'black']: { kingSide: false, queenSide: false },
        };
        setCastlingRights(updatedRights);
        setEnPassantTarget(null);
        setBoard(newBoard);

        const move = {
          from: { row: selected.row, col: selected.col },
          to: { row, col },
          piece: selectedPiece,
          castle: kingSide ? 'O-O' : 'O-O-O',
          board: cloneBoard(newBoard),
          turn: turn,
          kingState: deepClone(kingState),
          enPassantTarget: null,
          castlingRights: deepClone(updatedRights),
        };

        recordMove(move);
        setTurn(prev => (prev === 'white' ? 'black' : 'white'));
        setSelected(null);
        return;
      }

      // Ensure only current player's pieces can move
      const isWhiteTurn = turn === 'white';
      const isWhitePieceSelected = isWhitePiece(selectedPiece);
      if ((isWhiteTurn && !isWhitePieceSelected) || (!isWhiteTurn && isWhitePieceSelected)) {
        return;
      }


      if (selectedPiece === '♔' || selectedPiece === '♚') {
        setLastKingMove({
          fromRow: selected.row,
          fromCol: selected.col,
          toRow: row,
          toCol: col,
        });
      }      

      if (isWhitePromotion || isBlackPromotion) {
        setPromotionOptions({
          row,
          col,
          fromRow: selected.row,
          fromCol: selected.col,
          color: movedPiece === '♙' ? 'white' : 'black'
        });
        setEnPassantTarget(null);
        return;
      }

      // En passant capture
      if (
        (movingPawn === '♙' || movingPawn === '♟') &&
        enPassantTarget &&
        row === enPassantTarget.row &&
        col === enPassantTarget.col
      ) {
        const captureRow = selected.row;
        newBoard[captureRow][col] = ''; // Remove the passed pawn
      }
    
      // Set new en passant target
      const diff = Math.abs(row - selected.row);
      let newEnPassantTarget = null;
      if ((movingPawn === '♙' || movingPawn === '♟') && diff === 2) {
        newEnPassantTarget = { row: (row + selected.row) / 2, col };
      }
      setEnPassantTarget(newEnPassantTarget);

      newBoard[row][col] = selectedPiece;
      newBoard[selected.row][selected.col] = '';

      const updatedRights = { ...castlingRights };
      if (selectedPiece === '♔') {
        updatedRights.white.kingSide = false;
        updatedRights.white.queenSide = false;
      } else if (selectedPiece === '♚') {
        updatedRights.black.kingSide = false;
        updatedRights.black.queenSide = false;
      } else if (selectedPiece === '♖' && selected.row === 7 && selected.col === 0) {
        updatedRights.white.queenSide = false;
      } else if (selectedPiece === '♖' && selected.row === 7 && selected.col === 7) {
        updatedRights.white.kingSide = false;
      } else if (selectedPiece === '♜' && selected.row === 0 && selected.col === 0) {
        updatedRights.black.queenSide = false;
      } else if (selectedPiece === '♜' && selected.row === 0 && selected.col === 7) {
        updatedRights.black.kingSide = false;
      }
      if (targetPiece === '♖') {
        if (row === 7 && col === 0) updatedRights.white.queenSide = false;
        if (row === 7 && col === 7) updatedRights.white.kingSide = false;
      } else if (targetPiece === '♜') {
        if (row === 0 && col === 0) updatedRights.black.queenSide = false;
        if (row === 0 && col === 7) updatedRights.black.kingSide = false;
      }
      setCastlingRights(updatedRights);

      setBoard(newBoard);

      const isKing = selectedPiece === '♔' || selectedPiece === '♚';
      const pieceColor = selectedPiece === '♔' ? 'white' : 'black';
      const homeRow = isKing ? (pieceColor === 'white' ? 7 : 0) : null;
      const enemyRow = isKing ? (pieceColor === 'white' ? 0 : 7) : null;
      const reachedBackRank = isKing && row === enemyRow;
      const isBackHome = isKing && row === homeRow;

      let newKingState = kingState;
      if (isKing) {
        newKingState = {
          ...kingState,
          [pieceColor]: {
            ...kingState[pieceColor],
            returnedHome: isBackHome ? true : kingState[pieceColor].returnedHome,
            hasSummoned: isBackHome ? false : kingState[pieceColor].hasSummoned,
            needsReturn: isBackHome ? false : kingState[pieceColor].needsReturn,
          },
        };
      }

      const shouldWaitForSummon =
        isKing &&
        reachedBackRank &&
        !kingState[pieceColor].hasSummoned &&
        (!kingState[pieceColor].needsReturn || kingState[pieceColor].returnedHome);

      let moveKingState = newKingState;

      if (!shouldWaitForSummon) {
        const move = {
          from: { row: selected.row, col: selected.col },
          to: { row, col },
          piece: selectedPiece,
          captured: board[row][col] || null,
          board: cloneBoard(newBoard),
          turn: turn,
          kingState: deepClone(moveKingState),
          enPassantTarget: newEnPassantTarget,
          castlingRights: deepClone(updatedRights),
        };

        recordMove(move);
        setTurn(prev => (prev === 'white' ? 'black' : 'white'));
      }
      

      if (selectedPiece === '♔' || selectedPiece === '♚') {
        // const isWhite = selectedPiece === '♔';
        // const homeRow = isWhite ? 7 : 0;
        // const enemyRow = isWhite ? 0 : 7;
        // const pieceColor = isWhite ? 'white' : 'black';

        // const isBackHome = row === homeRow;

        // Perform summon GUI logic on the **new board**
        const updatedBoard = newBoard;

        if (
          row === enemyRow &&
          !kingState[pieceColor].hasSummoned &&
          (!kingState[pieceColor].needsReturn || kingState[pieceColor].returnedHome)
        ) {
          const potentialCols = [];

          const candidateCols = [-1, 1]
            .map(offset => col + offset)
            .filter(c => c >= 0 && c < 8);

          for (const c of candidateCols) {
            const neighbor = updatedBoard[row][c];
            const isFriendly = neighbor && isSameTeam(neighbor, pieceColor === 'white' ? '♙' : '♟');
            if (!isFriendly) {
              potentialCols.push(c);
            }
          }

          // Always include fromCol if it's adjacent and empty (for corner case fix)
          if (
            lastKingMove &&
            lastKingMove.toRow === row &&
            Math.abs(lastKingMove.fromCol - col) === 1 &&
            !potentialCols.includes(lastKingMove.fromCol)
          ) {
            const fromCol = lastKingMove.fromCol;
            if (fromCol >= 0 && fromCol < 8) {
              const pieceAtFromCol = updatedBoard[row][fromCol];
              const isFriendly = pieceAtFromCol && isSameTeam(pieceAtFromCol, pieceColor === 'white' ? '♙' : '♟');
              if (!isFriendly) {
                potentialCols.push(fromCol);
              }
            }
          }
        
          if (potentialCols.length > 0) {
            setSummonOptions({ row, col, color: pieceColor, cols: potentialCols });
          }
        }

        setKingState(newKingState);
      }
   
    }

    setSelected(null);
  };
  // Used to reset the game after checkmate
  const resetGame = () => {
    setBoard(cloneBoard(initialBoard));
    setSelected(null);
    setEnPassantTarget(null);
    setKingState({
      white: { hasSummoned: false, needsReturn: false, returnedHome: false },
      black: { hasSummoned: false, needsReturn: false, returnedHome: false },
    });
    setSummonOptions(null);
    setPromotionOptions(null);
    setCastlingRights({
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    });
    setLastKingMove(null);
    setTurn('white');
    setMoveHistory([]);
    setHistoryIndex(-1);
    setStatusMessage('');
    setCheckmateInfo(null);
    setDrawInfo(null);
    setResignInfo(null);
    setHalfmoveClock(0);
    const key = boardKey(
      initialBoard,
      'white',
      { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } },
      null
    );
    positionCountsRef.current = { [key]: 1 };
    // console.log('boardKey', key, 'count', 1);
    if (!suppressRef.current) {
      bcRef.current?.postMessage({ type: 'reset', senderId: instanceIdRef.current });
    }
  };

  useEffect(() => {
    const bc = new BroadcastChannel('omega-chess');
    bcRef.current = bc;
    bc.onmessage = (event) => {
      const { type, move, senderId } = event.data;
      if (senderId === instanceIdRef.current) return;
      if (type === 'move') {
        suppressRef.current = true;
        if (modeRef.current === 'analysis') {
          forceExitAnalysis();
        }
        setBoard(cloneBoard(move.board));
        setTurn(move.turn === 'white' ? 'black' : 'white');
        if (move.kingState) setKingState(deepClone(move.kingState));
        if (move.castlingRights) setCastlingRights(deepClone(move.castlingRights));
        setEnPassantTarget(move.enPassantTarget || null);
        if (recordMoveRef.current) recordMoveRef.current(move, true);
        setReviewMode(false);
        reviewModeRef.current = false;
        suppressRef.current = false;
      } else if (type === 'undo') {
        suppressRef.current = true;
        if (modeRef.current === 'analysis') {
          forceExitAnalysis();
        }
        if (remoteUndoRef.current) remoteUndoRef.current();
        suppressRef.current = false;
      } else if (type === 'reset') {
        suppressRef.current = true;
        if (modeRef.current === 'analysis') {
          forceExitAnalysis();
        }
        resetGame();
        suppressRef.current = false;
      }
    };
    return () => bc.close();
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {checkmateInfo && (
        <div className="overlay" onClick={() => setCheckmateInfo(null)}>
          <div className="checkmate-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '12px', fontSize: '24px' }}>
              Checkmate! {checkmateInfo.winner} wins.
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button onClick={resetGame}>Play Again</button>
              <button onClick={() => setCheckmateInfo(null)}>Review Game</button>
            </div>
          </div>
        </div>
      )}
      {drawInfo && (
        <div className="overlay" onClick={() => setDrawInfo(null)}>
          <div className="checkmate-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '12px', fontSize: '24px' }}>
              {drawInfo.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button onClick={resetGame}>Play Again</button>
              <button onClick={() => setDrawInfo(null)}>Review Game</button>
            </div>
          </div>
        </div>
      )}
      {resignInfo && (
        <div className="overlay" onClick={() => setResignInfo(null)}>
          <div className="checkmate-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '12px', fontSize: '24px' }}>
              Resignation! {resignInfo.winner} wins.
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button onClick={resetGame}>Play Again</button>
              <button onClick={() => setResignInfo(null)}>Review Game</button>
            </div>
          </div>
        </div>
      )}
      <div
        style={{ position: 'relative', width: '840px', height: '840px' }}
      //   onClick={() => {
      //   if (promotionOptions) {
      //     setPromotionOptions(null);
      //     setSelected(null); // <== Add this
      //   }
      //   if (summonOptions) {
      //     setSummonOptions(null);
      //     setSelected(null); // <== Add this
      //   }
      // }}
      >
      <svg
        width="840"
        height="840"
        className="annotation-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <marker
            id="ann-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="4"
            refY="2.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M3,1 L6,2.5 L3,4 Z" fill="orange" />
          </marker>
        </defs>
        {annotations.map((a, i) => {
  if (a.type === 'circle') return null;

  const df = toDisplayCoords(a.from.row, a.from.col);
  const dt = toDisplayCoords(a.to.row, a.to.col);
  const x1 = df.col * squareSize + squareSize / 2 + boardOffset;
  const y1 = df.row * squareSize + squareSize / 2 + boardOffset;
  const x2 = dt.col * squareSize + squareSize / 2 + boardOffset;
  const y2 = dt.row * squareSize + squareSize / 2 + boardOffset;

  let xEnd = x2;
  let yEnd = y2;
  let marker = undefined;

  if (a.type === 'arrow') {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const shorten = 25;
    xEnd = x2 - (dx / len) * shorten;
    yEnd = y2 - (dy / len) * shorten;
    marker = 'url(#ann-arrow)';
  }

  const stroke = a.type === 'arrow' ? 'orange' : 'red';

  return (
    <line
      key={i}
      x1={x1}
      y1={y1}
      x2={xEnd}
      y2={yEnd}
      stroke={stroke}
      strokeWidth={12}
      markerEnd={marker}
      opacity="0.65"
    />
  );
})}

      </svg>
      <svg
        width="840"
        height="840"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >

        {selected && (() => {
          let validMoves = [];
          const piece = board[selected.row][selected.col];
          if (piece === '♙' || piece === '♟') validMoves = getValidPawnMoves(board, selected.row, selected.col, piece, enPassantTarget);
          else if (piece === '♖' || piece === '♜') validMoves = getValidRookMoves(board, selected.row, selected.col, piece);
          else if (piece === '♕' || piece === '♛') validMoves = getValidQueenMoves(board, selected.row, selected.col, piece);
          else if (piece === '♘' || piece === '♞') validMoves = getValidKnightMoves(board, selected.row, selected.col, piece);
          else if (piece === '♗' || piece === '♝') validMoves = getValidBishopMoves(board, selected.row, selected.col, piece);
          else if (piece === '♔' || piece === '♚') {
            const key = piece === '♔' ? 'white' : 'black';
            validMoves = getValidKingMoves(
              board,
              selected.row,
              selected.col,
              piece,
              kingState[key],
              castlingRights
            );
          }

          validMoves = filterLegalMoves(validMoves, board, selected.row, selected.col, piece, enPassantTarget);

          return validMoves.map((move, i) => {
            if (!Array.isArray(move) || typeof move[0] !== 'number' || typeof move[1] !== 'number') return null;
          
            const [r, c] = move;
            const target = board[r]?.[c];
            const isEnemy = target && !isSameTeam(piece, target);
            const disp = toDisplayCoords(r, c);
            const endX = disp.col * 105 + 52.5 + 4;
            const endY = disp.row * 105 + 52.5 + 4;
            if (isEnemy) {
              return (
              //   <line
              //   key={"line-" + i}
              //   x1={startX}
              //   y1={startY}
              //   x2={endX}
              //   y2={endY}
              //   stroke="lime"
              //   strokeWidth={3}
              //   strokeOpacity={0.6}
              // />

              <circle
                key={"attack-" + i}
                cx={endX}
                cy={endY}
                r={43}
                fill="none"
                stroke="black"
                strokeWidth={10}
                opacity="0.2"
              />
              );
            }
            return (
              // <line
              //   key={"line-" + i}
              //   x1={startX}
              //   y1={startY}
              //   x2={endX}
              //   y2={endY}
              //   stroke="lime"
              //   strokeWidth={3}
              //   strokeOpacity={0.6}
              // />
                
              <circle
                key={"move-" + i}
                cx={endX}
                cy={endY}
                r={15}
                fill="black"
                opacity="0.2"
              />
            );
          });
        })()}
      </svg>

      {summonOptions && (
        <div className="summon-ui" onClick={(e) => e.stopPropagation()}>
          {[summonOptions.col - 1, summonOptions.col + 1]
            .filter(c => {
              const neighborPiece = board[summonOptions.row]?.[c];
              if (!neighborPiece) return true;
              return !isSameTeam(neighborPiece, summonOptions.color === 'white' ? '♙' : '♟');
            })
            .filter(c => c >= 0 && c < 8) // prevent out-of-bounds
            .map((c) => (
              <div
                key={c}
                className="summon-column"
                style={{
                  left: `${toDisplayCoords(summonOptions.row, c).col * 105 + 4}px`,
                  top: `${overlayTop(summonOptions.row)}px`,
                }}
              >
                {summonSymbols.map((symbol, i) => (
                  <img
                    key={i}
                    src={`/src/assets/pieces/${pieceImagesMap[summonOptions.color][symbol]}`}
                    alt={symbol}
                    style={{ width: '80px', height: '80px', margin: '5px', cursor: 'pointer' }}
                    onClick={() => {
                      const newBoard = performSummon(board, summonOptions.row, c, summonOptions.color, symbol);

                      const newKingState = {
                        ...kingState,
                        [summonOptions.color]: {
                          hasSummoned: true,
                          needsReturn: true,
                          returnedHome: false,
                        }
                      };
                      setKingState(newKingState);

                      // then snapshot the move after updating

                      const move = {
                        from: lastKingMove
                          ? { row: lastKingMove.fromRow, col: lastKingMove.fromCol }
                          : { row: summonOptions.row, col: summonOptions.col },
                        to: { row: summonOptions.row, col: summonOptions.col },
                        piece: summonOptions.color === 'white' ? '♔' : '♚',
                        summon: {
                          piece: symbol,
                          to: { row: summonOptions.row, col: c }
                        },
                        board: cloneBoard(newBoard),
                        turn: turn,
                        kingState: deepClone(newKingState),
                        enPassantTarget,
                        castlingRights: deepClone(castlingRights),
                      };

                      // THEN update game state
                      
                      recordMove(move);
                      setBoard(newBoard);
                      setTurn(prev => (prev === 'white' ? 'black' : 'white'));
                      setSummonOptions(null);
                      setLastKingMove(null);
                      setSelected(null);                 

                    }}
                  />
                ))}
                <button onClick={(e) => {
                  e.stopPropagation();

                  const move = {
                    from: lastKingMove
                      ? { row: lastKingMove.fromRow, col: lastKingMove.fromCol }
                      : { row: summonOptions.row, col: summonOptions.col },
                    to: { row: summonOptions.row, col: summonOptions.col },
                    piece: summonOptions.color === 'white' ? '♔' : '♚',
                    board: cloneBoard(board),
                    turn: turn,
                    kingState: deepClone(kingState),
                    enPassantTarget,
                    castlingRights: deepClone(castlingRights),
                  };

                  recordMove(move);
                  setSummonOptions(null);
                  setLastKingMove(null);
                  setTurn(prev => (prev === 'white' ? 'black' : 'white'));
                  setSelected(null);
                }}>X</button>
              </div>
            ))}
        </div>
      )}

      {promotionOptions && (
        <div className="summon-ui" onClick={(e) => e.stopPropagation()}>
          {[promotionOptions.col].map((c) => (
            <div
              key={c}
              className="summon-column"
              style={{
                left: `${toDisplayCoords(promotionOptions.row, c).col * 105 + 4}px`,
                top: `${overlayTop(promotionOptions.row)}px`,
              }}
            >
              {(promotionOptions.color === 'white' ? ['♕', '♘', '♖', '♗'] : ['♛', '♞', '♜', '♝']).map((symbol, i) => (
                <img
                  key={i}
                  src={`/src/assets/pieces/${pieceImagesMap[promotionOptions.color][symbol]}`}
                  alt={symbol}
                  style={{ width: '80px', height: '80px', margin: '5px', cursor: 'pointer' }}

                  onClick={() => {
                    const newBoard = performPromotion(
                      board,
                      promotionOptions.row,
                      promotionOptions.col,
                      promotionOptions.fromRow,
                      promotionOptions.fromCol,
                      promotionOptions.color,
                      symbol
                    );

                    const move = {
                      from: { row: promotionOptions.fromRow, col: promotionOptions.fromCol },
                      to: { row: promotionOptions.row, col: promotionOptions.col },
                      piece: promotionOptions.color === 'white' ? '♙' : '♟',
                      promotion: symbol,
                      board: cloneBoard(newBoard),
                      turn: turn,
                      enPassantTarget,
                      castlingRights: deepClone(castlingRights),
                    };

                    recordMove(move);
                    setBoard(newBoard);
                    setPromotionOptions(null);
                    setSelected(null);
                    setTurn(prev => (prev === 'white' ? 'black' : 'white'));
                  }}
                />
              ))}
              <button onClick={() => {
                setPromotionOptions(null);
                setSelected(null); // <== Add this
              }}>X</button>
            </div>
          ))}
        </div>
      )}

      {statusMessage && (
        <div style={{ color: 'white', marginBottom: '8px', fontWeight: 'bold' }}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px' }}>
        {/* Left: Board container */}
        <div
          style={{ position: 'relative', width: '840px', height: '840px' }} ref={boardRef} onMouseDown={handleBoardMouseDown} onMouseUp={handleBoardMouseUp} onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (promotionOptions) {
              setPromotionOptions(null);
              setSelected(null);
            }
            if (summonOptions) {
              setSummonOptions(null);
              setSelected(null);
            }
          }}
        >
          {/* Your board rendering below */}
          <div className={`board${mode === 'analysis' ? ' analysis' : ''}`} style={{ zIndex: 1, position: 'relative' }}>
          {Array.from({ length: 8 }).map((_, dispRow) => (
              <div key={dispRow} className="row">
                {Array.from({ length: 8 }).map((_, dispCol) => {
                  const { row: br, col: bc } = fromDisplayCoords(dispRow, dispCol);
                  const piece = board[br][bc];
                  const isDark = (br + bc) % 2 === 1;
                  const isSelected = selected?.row === br && selected?.col === bc;

                  const key = `${br}-${bc}`;
                  const isLastFrom = key === lastFromKey;
                  const isLastTo = key === lastToKey;
                  const isCheck = checkSquares.has(key);
                  const isCircleAnn = annotations.some(
                    (a) => a.type === 'circle' && a.row === br && a.col === bc
                  );

                  return (
                    <div
                      key={dispCol}
                      className={`square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleClick(br, bc)}
                    >
                      {(isLastFrom || isLastTo) && (
                        <div
                          className="highlight-overlay last-move-overlay"
                        ></div>
                      )}
                      {isCheck && (
                        <div
                          className="highlight-overlay check-overlay"
                        ></div>
                      )}
                      {isCircleAnn && (
                        <div
                          className="highlight-overlay check-overlay"
                        ></div>
                      )}
                      <div
                        className="label"
                        style={{
                          position: 'absolute',
                          top: '4px',
                          left: '7px',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: isDark ? '#f0d9b5' : '#b58863',
                        }}
                      >
                        {dispCol === 0
                          ? playerColor === 'white'
                            ? 8 - dispRow
                            : dispRow + 1
                          : ''}
                      </div>
                      <div
                        className="label"
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '10px',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: isDark ? '#f0d9b5' : '#b58863',
                        }}
                      >
                        {dispRow === 7 ? String.fromCharCode(97 + bc) : ''}
                      </div>
                      {piece && (
                        <img
                          src={`/src/assets/pieces/${pieceImages[piece]}`}
                          alt={piece}
                          style={{ width: '80%', height: '80%' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div> {/* End of board container */}

        {/* Right: Sidebar */}
        <div style={{ width: '200px', color: 'white' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <button onClick={undoMove} disabled={(mode === 'analysis' ? analysisIndex : historyIndex) < 0}>Undo</button>
            <button onClick={redoMove} disabled={mode === 'analysis' ? analysisIndex >= analysisHistory.length - 1 : historyIndex >= moveHistory.length - 1}>Redo</button>
            <button onClick={() => setDrawInfo({ type: 'agreement', message: 'Draw by agreement.' })}>Draw</button>
            <button onClick={() => setResignInfo({ winner: turn === 'white' ? 'black' : 'white' })}>Resign</button>
            {mode === 'analysis' && (
              <button onClick={deactivateAnalysis}>Exit Analysis</button>
            )}
            {reviewMode && mode === 'play' && (
              <div style={{ color: 'yellow', fontWeight: 'bold' }}>Review Mode</div>
            )}
          </div>
          <div 
            ref={moveListRef}
            style={{
            width: '330px',
            color: 'white',
            maxHeight: '500px',
            overflowY: 'auto',
            paddingRight: '8px'
          }}>
            <ol style={{ paddingLeft: '20px', listStyle: 'none', margin: 0 }}>
              {Array.from({ length: Math.ceil((historyIndex + 1) / 2) }).map((_, i) => {
                const whiteMove = moveHistory[i * 2];
                const blackMove = moveHistory[i * 2 + 1];

                const turnNum = i + 1;
                // const whiteText = whiteMove
                //   ? `W: ${whiteMove.piece} ${String.fromCharCode(97 + whiteMove.from.col)}${8 - whiteMove.from.row}→${String.fromCharCode(97 + whiteMove.to.col)}${8 - whiteMove.to.row}`
                //   : '';
                // const blackText = blackMove
                //   ? `B: ${blackMove.piece} ${String.fromCharCode(97 + blackMove.from.col)}${8 - blackMove.from.row}→${String.fromCharCode(97 + blackMove.to.col)}${8 - blackMove.to.row}`
                //   : '';

                let whiteText = '';
                if (whiteMove) {
                  

                  if (whiteMove.castle) {
                    whiteText = `W: ${whiteMove.castle}`;
                  } else {
                    const from = coordLabel(whiteMove.from.row, whiteMove.from.col);
                    const to = coordLabel(whiteMove.to.row, whiteMove.to.col);
                    whiteText = `W: ${whiteMove.piece} ${from}→${to}`;
                  }

                  if (whiteMove.promotion) {
                    whiteText += `=${whiteMove.promotion}`;
                  }

                  if (whiteMove.summon) {
                    const summonTo = coordLabel(
                      whiteMove.summon.to.row,
                      whiteMove.summon.to.col
                    );
                    whiteText += `+${whiteMove.summon.piece}${summonTo}`;
                  }
                }
                let blackText = '';
                if (blackMove) {
                  

                  if (blackMove.castle) {
                    blackText = `B: ${blackMove.castle}`;
                  } else {
                    const from = coordLabel(blackMove.from.row, blackMove.from.col);
                    const to = coordLabel(blackMove.to.row, blackMove.to.col);
                    blackText = `B: ${blackMove.piece} ${from}→${to}`;
                  }

                  if (blackMove.promotion) {
                    blackText += `=${blackMove.promotion}`;
                  }

                  if (blackMove.summon) {
                    const summonTo = coordLabel(
                      blackMove.summon.to.row,
                      blackMove.summon.to.col
                    );
                    blackText += `+${blackMove.summon.piece}${summonTo}`;
                  }
                }

                const isWhiteBold = historyIndex === i * 2;
                const isBlackBold = historyIndex === i * 2 + 1;

                return (
                  <li key={i} style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span
                      onClick={() => jumpToMove(i * 2)}
                      style={{
                        fontWeight: isWhiteBold ? 'bold' : 'normal',
                        minWidth: '140px',
                        cursor: 'pointer'
                      }}
                    >
                      {turnNum}. {whiteText}
                    </span>
                    <span
                      onClick={() => jumpToMove(i * 2 + 1)}
                      style={{
                        marginLeft: '16px',
                        fontWeight: isBlackBold ? 'bold' : 'normal',
                        minWidth: '120px',
                        cursor: 'pointer'
                      }}
                    >
                      {blackText}
                    </span>
                  </li>

                );
              })}
              {mode === 'analysis' && (() => {
                const groups = [];
                for (let i = 0; i < analysisHistory.length; i += 2) {
                  groups.push({ first: analysisHistory[i], second: analysisHistory[i + 1], index: i });
                }

                const renderMoveText = (m) => {
                  if (!m) return '';
                  let t = '';
                  if (m.castle) {
                    t = m.castle;
                  } else {
                    const from = coordLabel(m.from.row, m.from.col);
                    const to = coordLabel(m.to.row, m.to.col);
                    t = `${m.piece} ${from}→${to}`;
                  }
                  if (m.promotion) t += `=${m.promotion}`;
                  if (m.summon) {
                    const summonTo = coordLabel(m.summon.to.row, m.summon.to.col);
                    t += `+${m.summon.piece}${summonTo}`;
                  }
                  return t;
                };

                return groups.map((g, i) => {
                  const firstText = renderMoveText(g.first);
                  const secondText = renderMoveText(g.second);
                  const firstLabel = g.first ? (g.first.turn === 'white' ? 'W:' : 'B:') : '';
                  const secondLabel = g.second ? (g.second.turn === 'white' ? 'W:' : 'B:') : '';
                  const isFirstBold = analysisIndex === g.index;
                  const isSecondBold = analysisIndex === g.index + 1;

                  return (
                    <li key={`a${i}`} style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span
                        onClick={() => jumpToMove(g.index)}
                        style={{
                          fontWeight: isFirstBold ? 'bold' : 'normal',
                          minWidth: '140px',
                          cursor: 'pointer'
                        }}
                      >
                        🧪 {firstLabel} {firstText}
                      </span>
                      <span
                        onClick={() => jumpToMove(g.index + 1)}
                        style={{
                          marginLeft: '16px',
                          fontWeight: isSecondBold ? 'bold' : 'normal',
                          minWidth: '120px',
                          cursor: 'pointer'
                        }}
                      >
                        {secondLabel} {secondText}
                      </span>
                    </li>
                  );
                });
              })()}
              
            </ol>

          </div>
        </div>
      </div>
    </div>
    <img
      src="src/assets/logo.png"
      alt="Ωhess Logo"
      className="omega-logo"
    />
  </div>
    
  );
}

export default App;
// 1480 -> 1430