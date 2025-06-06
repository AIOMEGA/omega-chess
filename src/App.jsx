import { useState, useEffect, useRef } from 'react';
import './App.css';

// Unicode pieces (♙♘♗♖♕♔ / ♟♞♝♜♛♚)
// Hard coded board preset positions
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

// Used to set each unicode piece to a svg image I got from https://github.com/lichess-org/lila/tree/master/public/piece
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

// Piece groups for easier color checks
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

const cloneBoard = (board) => board.map((r) => [...r]);
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

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

function getValidQueenMoves(board, row, col, piece) {
  const isWhite = piece === '♕';

  const validMoves = [];

  const isEnemy = (target) => isEnemyPiece(target, isWhite);

  const isBlocked = (r, c) => board[r][c] !== '';

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

function filterLegalMoves(moves, board, fromRow, fromCol, piece, enPassantTarget) {
  const color = WHITE_PIECES.includes(piece) ? 'white' : 'black';
  const legal = [];
  for (const move of moves) {
    if (!Array.isArray(move)) {
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
      const newBoard = cloneBoard(board);
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

function getValidKingMoves(board, row, col, piece, kingState, castlingRights) {
  const isWhite = piece === '♔';
  const isEnemy = (target) => isEnemyPiece(target, isWhite);
  const sameTeam = (target) => isWhitePiece(target) === isWhite;

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

function performSummon(board, row, col, color, pieceType = '♕') {
  const newBoard = cloneBoard(board);
  newBoard[row][col] = pieceType;
  return newBoard;
}

function performPromotion(board, row, col, fromRow, fromCol, color, piece) {
  const newBoard = deepClone(board);
  newBoard[fromRow][fromCol] = '';
  newBoard[row][col] = piece;
  return newBoard;
}

function App() {
  const [board, setBoard] = useState(initialBoard);
  const [selected, setSelected] = useState(null);
  const [enPassantTarget, setEnPassantTarget] = useState(null); // e.g. { row: 3, col: 4 }

  const [kingState, setKingState] = useState({
    white: { hasSummoned: false, needsReturn: false, returnedHome: false },
    black: { hasSummoned: false, needsReturn: false, returnedHome: false },
  });

  const [summonOptions, setSummonOptions] = useState(null); // e.g., { row: 0, col: 4, color: 'black' }

  const [promotionOptions, setPromotionOptions] = useState(null); // { row, col, color, fromRow, fromCol }

  const [castlingRights, setCastlingRights] = useState({
    white: { kingSide: true, queenSide: true },
    black: { kingSide: true, queenSide: true },
  });

  const [lastKingMove, setLastKingMove] = useState(null); // { fromRow, fromCol, toRow, toCol }

  const [turn, setTurn] = useState('white');

  const [moveHistory, setMoveHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // index of current move

  const [statusMessage, setStatusMessage] = useState('');

  // Helper to record moves into history
  const recordMove = (move) => {
    const newHistory = moveHistory.slice(0, historyIndex + 1);
    newHistory.push(move);
    setMoveHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // useEffects

  const moveListRef = useRef(null);
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [historyIndex]);

  useEffect(() => {
    const inCheck = isKingInCheck(board, turn);
    if (inCheck) {
      const hasMoves = hasAnyLegalMoves(board, turn, kingState, enPassantTarget, castlingRights);
      if (hasMoves) {
        setStatusMessage('');
        // setStatusMessage(`${turn} is in check`);
      } else {
        setStatusMessage('');
        // setStatusMessage(`${turn} is in checkmate!`);
      }
    } else {
      setStatusMessage('');
    }
  }, [board, turn]);

  const undoMove = () => {
    if (historyIndex < 0) return;
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
  };
  
  const redoMove = () => {
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
  };

  const jumpToMove = (index) => {
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

  const handleClick = (row, col) => {
    const piece = board[row][col];
    const color = piece === '♔' ? 'white' : 'black'; 

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
      validMoves = getValidKingMoves(board, selected.row, selected.col, selectedPiece, kingState, castlingRights);
    }
    validMoves = filterLegalMoves(validMoves, board, selected.row, selected.col, selectedPiece, enPassantTarget);

    
    const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
    
    if (isValidMove) {
      const newBoard = cloneBoard(board);
      const movingPawn = selectedPiece;
    
      const movedPiece = board[selected.row][selected.col];
      const isPawn = movedPiece === '♙' || movedPiece === '♟';
      const targetRow = row;

      const isWhitePromotion = isPawn && movedPiece === '♙' && targetRow === 0;
      const isBlackPromotion = isPawn && movedPiece === '♟' && targetRow === 7;

      // Castling move
      if ((selectedPiece === '♔' || selectedPiece === '♚') && Math.abs(col - selected.col) === 2 && row === selected.row) {
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
      const color = selectedPiece === '♔' ? 'white' : 'black';
      const reachedBackRank = (isKing && (
        (turn === 'white' && row === 0) || 
        (turn === 'black' && row === 7))
      );
      const shouldWaitForSummon = 
      isKing && 
      reachedBackRank &&
      !kingState[color].hasSummoned &&
      (!kingState[color].needsReturn || kingState[color].returnedHome);

      if (!shouldWaitForSummon) {
        const move = {
          from: { row: selected.row, col: selected.col },
          to: { row, col },
          piece: selectedPiece,
          captured: board[row][col] || null,
          board: cloneBoard(newBoard),
          turn: turn,
          kingState: deepClone(kingState),
          enPassantTarget: newEnPassantTarget,
          castlingRights: deepClone(updatedRights),
        };

        recordMove(move);
        setTurn(prev => (prev === 'white' ? 'black' : 'white'));
      }
      

      if (selectedPiece === '♔' || selectedPiece === '♚') {
        const isWhite = selectedPiece === '♔';
        const homeRow = isWhite ? 7 : 0;
        const enemyRow = isWhite ? 0 : 7;
        const pieceColor = isWhite ? 'white' : 'black';

        const isBackHome = row === homeRow;

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

        setKingState(prev => ({
          ...prev,
          [pieceColor]: {
            ...prev[pieceColor],
            returnedHome: isBackHome ? true : prev[pieceColor].returnedHome,
            hasSummoned: isBackHome ? false : prev[pieceColor].hasSummoned,
            needsReturn: isBackHome ? false : prev[pieceColor].needsReturn,
          }
        }));
      }
   
    }
    setSelected(null);
    
    

  };
  

  return (
    <div
      style={{ position: 'relative', width: '840px', height: '840px' }}
      onClick={() => {
        if (promotionOptions) {
          setPromotionOptions(null);
          setSelected(null); // <== Add this
        }
        if (summonOptions) {
          setSummonOptions(null);
          setSelected(null); // <== Add this
        }
      }}      
    >  
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
          else if (piece === '♔' || piece === '♚') validMoves = getValidKingMoves(board, selected.row, selected.col, piece, kingState, castlingRights);

          validMoves = filterLegalMoves(validMoves, board, selected.row, selected.col, piece, enPassantTarget);

          return validMoves.map((move, i) => {
            if (!Array.isArray(move) || typeof move[0] !== 'number' || typeof move[1] !== 'number') return null;
          
            const [r, c] = move;
            const target = board[r]?.[c];
            const isEnemy = target && !isSameTeam(piece, target);
            const endX = c * 105 + 52.5 + 4;
            const endY = r * 105 + 52.5 + 4;
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
                  left: `${c * 105 + 4}px`,
                  top: `${summonOptions.row * 105 - (summonOptions.color === 'black' ? 315 : 0)}px`,
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
                left: `${c * 105 + 4}px`,
                top: `${promotionOptions.color === 'black' ? promotionOptions.row * 105 - 315 : promotionOptions.row * 105}px`,
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
          style={{ position: 'relative', width: '840px', height: '840px' }}
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
          <div className="board" style={{ zIndex: 1, position: 'relative' }}>
            {board.map((rowArr, row) => (
              <div key={row} className="row">
                {rowArr.map((piece, col) => {
                  const isDark = (row + col) % 2 === 1;
                  const isSelected = selected?.row === row && selected?.col === col;

                  return (
                    <div
                      key={col}
                      className={`square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleClick(row, col)}
                    >
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
                        {col === 0 ? 8 - row : ''}
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
                        {row === 7 ? String.fromCharCode(97 + col) : ''}
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
            <button onClick={undoMove} disabled={historyIndex < 0}>Undo</button>
            <button onClick={redoMove} disabled={historyIndex >= moveHistory.length - 1}>Redo</button>
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
                    const from = `${String.fromCharCode(97 + whiteMove.from.col)}${8 - whiteMove.from.row}`;
                    const to = `${String.fromCharCode(97 + whiteMove.to.col)}${8 - whiteMove.to.row}`;
                    whiteText = `W: ${whiteMove.piece} ${from}→${to}`;
                  }

                  if (whiteMove.promotion) {
                    whiteText += `=${whiteMove.promotion}`;
                  }

                  if (whiteMove.summon) {
                    const summonTo = `${String.fromCharCode(97 + whiteMove.summon.to.col)}${8 - whiteMove.summon.to.row}`;
                    whiteText += `+${whiteMove.summon.piece}${summonTo}`;
                  }
                }
                let blackText = '';
                if (blackMove) {
                  

                  if (blackMove.castle) {
                    blackText = `B: ${blackMove.castle}`;
                  } else {
                    const from = `${String.fromCharCode(97 + blackMove.from.col)}${8 - blackMove.from.row}`;
                    const to = `${String.fromCharCode(97 + blackMove.to.col)}${8 - blackMove.to.row}`;
                    blackText = `B: ${blackMove.piece} ${from}→${to}`;
                  }

                  if (blackMove.promotion) {
                    blackText += `=${blackMove.promotion}`;
                  }

                  if (blackMove.summon) {
                    const summonTo = `${String.fromCharCode(97 + blackMove.summon.to.col)}${8 - blackMove.summon.to.row}`;
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
            </ol>

          </div>
        </div>
      </div>
    </div>
    
  );
}

export default App;
// 1480 -> 1430