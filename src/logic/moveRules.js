// Pure move generation and validation utilities

import {
    cloneBoard,
    isWhitePiece,
    isBlackPiece,
    isEnemyPiece,
    WHITE_PIECES,
    BLACK_PIECES,
  } from '../utils/helpers.js';

// ---- Piece move generators ----

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

export {
    getValidPawnMoves,
    getValidRookMoves,
    getValidQueenMoves,
    getValidKnightMoves,
    getValidBishopMoves,
    getValidKingMoves,
    isSquareAttacked,
    getCheckingPieces,
    findKingPosition,
    isKingInCheck,
    simulateMove,
    filterLegalMoves,
    hasAnyLegalMoves
  };
  