// Utility functions for evaluating game state and endgame conditions
import {
    isWhitePiece,
    isBlackPiece,
  } from '../utils/helpers.js';
  import {
    getValidPawnMoves,
    getValidRookMoves,
    getValidQueenMoves,
    getValidKnightMoves,
    getValidBishopMoves,
    getValidKingMoves,
    filterLegalMoves,
    isSquareAttacked,
    findKingPosition,
  } from './moveRules.js';
  
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
  
  // Iterates all pieces of a given color and checks if at least one legal move
  // exists. Used for stalemate/checkmate detection.
  function hasAnyLegalMoves(board, color, kingState, enPassantTarget, castlingRights) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (color === 'white' && !isWhitePiece(piece)) continue;
        if (color === 'black' && !isBlackPiece(piece)) continue;
  
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
  
  // Records a board position for repetition detection. Returns true if this
  // position has occurred three or more times.
  function checkThreefoldRepetition(positionCountsRef, board, turn, castlingRights, enPassantTarget) {
    const counts = positionCountsRef.current;
    const key = boardKey(board, turn, castlingRights, enPassantTarget);
    const count = (counts[key] || 0) + 1;
    counts[key] = count;
    return count >= 3;
  }
  
  export {
    boardKey,
    getCheckingPieces,
    isKingInCheck,
    hasAnyLegalMoves,
    checkThreefoldRepetition,
  };