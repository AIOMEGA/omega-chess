import { useState, useRef, useCallback, useMemo } from 'react';
import {
  getValidPawnMoves,
  getValidRookMoves,
  getValidQueenMoves,
  getValidKnightMoves,
  getValidBishopMoves,
  getValidKingMoves,
  filterLegalMoves,
} from '../logic/moveRules.js';
import { getCheckingPieces } from '../logic/gameStatus.js';

export default function boardHighlights({
  board,
  playerColor,
  kingState,
  enPassantTarget,
  castlingRights,
  mode,
  moveHistory,
  historyIndex,
  analysisHistory,
  analysisIndex,
}) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [hoveredSquare, setHoveredSquare] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const boardRef = useRef(null);
  const rightDragRef = useRef({ dragging: false });

  const squareSize = 105;
  const boardOffset = 4;

  const toDisplayCoords = useCallback(
    (row, col) =>
      playerColor === 'white'
        ? { row, col }
        : { row: 7 - row, col: 7 - col },
    [playerColor]
  );

  const fromDisplayCoords = useCallback(
    (row, col) =>
      playerColor === 'white'
        ? { row, col }
        : { row: 7 - row, col: 7 - col },
    [playerColor]
  );

  const overlayTop = useCallback(
    (row) => {
      const dispRow = toDisplayCoords(row, 0).row;
      return dispRow <= 3 ? dispRow * squareSize : dispRow * squareSize - 315;
    },
    [toDisplayCoords]
  );

  const getSquareFromEvent = useCallback(
    (e) => {
      const rect = boardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - boardOffset;
      const y = e.clientY - rect.top - boardOffset;
      const displayCol = Math.floor(x / squareSize);
      const displayRow = Math.floor(y / squareSize);
      if (displayCol < 0 || displayCol > 7 || displayRow < 0 || displayRow > 7)
        return null;
      return fromDisplayCoords(displayRow, displayCol);
    },
    [fromDisplayCoords]
  );

  const toggleAnnotation = useCallback((ann) => {
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
        return copy;
      }
      return [...prev, ann];
    });
  }, []);

  const handleBoardMouseDown = useCallback(
    (e) => {
      if (e.button !== 2) return;
      e.preventDefault();
      const sq = getSquareFromEvent(e);
      if (!sq) return;
      rightDragRef.current = { dragging: true, start: sq, shift: e.shiftKey };
    },
    [getSquareFromEvent]
  );

  const handleBoardMouseUp = useCallback(
    (e) => {
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
        toggleAnnotation({ type: 'circle', row: sq.row, col: sq.col });
      } else if (data.shift) {
        toggleAnnotation({ type: 'line', from: data.start, to: sq });
      } else {
        toggleAnnotation({ type: 'arrow', from: data.start, to: sq });
      }
      rightDragRef.current.dragging = false;
    },
    [getSquareFromEvent, toggleAnnotation]
  );

  const activeHist = mode === 'analysis' ? analysisHistory : moveHistory;
  const activeIndex = mode === 'analysis' ? analysisIndex : historyIndex;
  const lastMove = useMemo(
    () => (activeIndex >= 0 ? activeHist[activeIndex] : null),
    [activeHist, activeIndex]
  );
  const lastFromKey = lastMove ? `${lastMove.from.row}-${lastMove.from.col}` : null;
  const lastToKey = lastMove ? `${lastMove.to.row}-${lastMove.to.col}` : null;

  const checkSquares = useMemo(() => {
    const set = new Set();
    const whiteCheck = getCheckingPieces(board, 'white');
    if (whiteCheck) {
      set.add(`${whiteCheck.king.row}-${whiteCheck.king.col}`);
      whiteCheck.attackers.forEach((a) => set.add(`${a.row}-${a.col}`));
    }
    const blackCheck = getCheckingPieces(board, 'black');
    if (blackCheck) {
      set.add(`${blackCheck.king.row}-${blackCheck.king.col}`);
      blackCheck.attackers.forEach((a) => set.add(`${a.row}-${a.col}`));
    }
    return set;
  }, [board]);

  const legalMoves = useMemo(() => {
    if (!selectedSquare) return [];
    const { row, col } = selectedSquare;
    const piece = board[row][col];
    if (!piece) return [];
    let moves = [];
    if (piece === '♙' || piece === '♟') {
      moves = getValidPawnMoves(board, row, col, piece, enPassantTarget);
    } else if (piece === '♖' || piece === '♜') {
      moves = getValidRookMoves(board, row, col, piece);
    } else if (piece === '♕' || piece === '♛') {
      moves = getValidQueenMoves(board, row, col, piece);
    } else if (piece === '♘' || piece === '♞') {
      moves = getValidKnightMoves(board, row, col, piece);
    } else if (piece === '♗' || piece === '♝') {
      moves = getValidBishopMoves(board, row, col, piece);
    } else if (piece === '♔' || piece === '♚') {
      const key = piece === '♔' ? 'white' : 'black';
      moves = getValidKingMoves(board, row, col, piece, kingState[key], castlingRights);
    }
    return filterLegalMoves(moves, board, row, col, piece, enPassantTarget);
  }, [selectedSquare, board, enPassantTarget, kingState, castlingRights]);

  return {
    selectedSquare,
    setSelectedSquare,
    hoveredSquare,
    setHoveredSquare,
    annotations,
    toggleAnnotation,
    legalMoves,
    lastFromKey,
    lastToKey,
    checkSquares,
    boardRef,
    toDisplayCoords,
    fromDisplayCoords,
    overlayTop,
    squareSize,
    boardOffset,
    handleBoardMouseDown,
    handleBoardMouseUp,
  };
}