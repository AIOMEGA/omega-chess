import { useState, useRef, useCallback, useEffect } from 'react';
import { cloneBoard, deepClone, boardKey } from '../utils/helpers.js';

export default function useMoveHistory({
  initialBoard,
  playerColor,
  mode,
  analysisSavedRef,
  setBoard,
  setTurn,
  setKingState,
  setCastlingRights,
  setEnPassantTarget,
  setReviewMode,
  reviewMode,
  reviewModeRef,
  sendMove,
  sendUndo,
  suppressRef,
  setHalfmoveClock,
  setDrawInfo,
  recordMoveRef: externalRecordMoveRef,
}) {
  const [moveHistory, setMoveHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [analysisIndex, setAnalysisIndex] = useState(-1);

  const moveHistoryRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const remoteUndoRef = useRef(null);
  const recordMoveRef = externalRecordMoveRef ?? useRef(null);
  const positionCountsRef = useRef({});

  useEffect(() => {
    const key = boardKey(
      initialBoard,
      'white',
      { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } },
      null
    );
    positionCountsRef.current = { [key]: 1 };
  }, [initialBoard]);

  const recordMove = useCallback(
    (move, forcePlay = false) => {
      if (mode === 'analysis' && !forcePlay) {
        const newHistory = analysisHistory.slice(0, analysisIndex + 1);
        newHistory.push(move);
        setAnalysisHistory(newHistory);
        setAnalysisIndex(newHistory.length - 1);
        return;
      }
      const baseHistory = forcePlay
        ? moveHistoryRef.current
        : moveHistory.slice(0, historyIndex + 1);

      const newHistory = [...baseHistory, move];
      setMoveHistory(newHistory);
      moveHistoryRef.current = newHistory;
      setHistoryIndex(newHistory.length - 1);
      historyIndexRef.current = newHistory.length - 1;

      if (!suppressRef.current) {
        sendMove?.(move);
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
        if (count >= 3) {
          setDrawInfo({ type: 'threefold', message: 'Draw by threefold repetition.' });
        }
      }
    },
    [mode, analysisHistory, analysisIndex, moveHistory, historyIndex, sendMove, suppressRef, setHalfmoveClock, setDrawInfo]
  );

  useEffect(() => {
    recordMoveRef.current = recordMove;
  }, [recordMove]);

  const undoMove = useCallback(() => {
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
        sendUndo?.();
      }
    }
  }, [mode, analysisIndex, analysisHistory, analysisSavedRef, historyIndex, moveHistory, playerColor, initialBoard, setBoard, setTurn, setKingState, setCastlingRights, setEnPassantTarget, setAnalysisIndex, setHistoryIndex, setMoveHistory, setReviewMode, reviewModeRef, sendUndo, suppressRef]);

  const redoMove = useCallback(() => {
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
    setBoard(cloneBoard(next.board));
    setTurn(next.turn === 'white' ? 'black' : 'white');
    if (next.kingState) setKingState(deepClone(next.kingState));
    if (next.castlingRights) setCastlingRights(deepClone(next.castlingRights));
    setEnPassantTarget(next.enPassantTarget || null);
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;

    const reviewing = newIndex < moveHistory.length - 1;
    setReviewMode(reviewing);
    reviewModeRef.current = reviewing;
  }, [mode, analysisIndex, analysisHistory, historyIndex, moveHistory, setBoard, setTurn, setKingState, setCastlingRights, setEnPassantTarget, setAnalysisIndex, setHistoryIndex, setReviewMode, reviewModeRef]);

  const handleRemoteUndo = useCallback(() => {
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
  }, [initialBoard, setBoard, setTurn, setKingState, setCastlingRights, setEnPassantTarget, setMoveHistory, setHistoryIndex, setReviewMode, reviewModeRef]);

  const jumpToMove = useCallback(
    (index) => {
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
        setBoard(cloneBoard(move.board));
        setTurn(move.turn === 'white' ? 'black' : 'white');
        if (move.kingState) setKingState(deepClone(move.kingState));
        if (move.castlingRights) setCastlingRights(deepClone(move.castlingRights));
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
    },
    [mode, analysisHistory, analysisSavedRef, moveHistory, initialBoard, setBoard, setTurn, setKingState, setCastlingRights, setEnPassantTarget, setAnalysisIndex, setHistoryIndex, setReviewMode, reviewModeRef]
  );

  useEffect(() => {
    moveHistoryRef.current = moveHistory;
    historyIndexRef.current = historyIndex;
    remoteUndoRef.current = handleRemoteUndo;
    reviewModeRef.current = reviewMode;
  }, [moveHistory, historyIndex, handleRemoteUndo, reviewMode, reviewModeRef]);

  return {
    moveHistory,
    setMoveHistory,
    historyIndex,
    setHistoryIndex,
    analysisHistory,
    setAnalysisHistory,
    analysisIndex,
    setAnalysisIndex,
    recordMove,
    recordMoveRef,
    undoMove,
    redoMove,
    jumpToMove,
    handleRemoteUndo,
    moveHistoryRef,
    historyIndexRef,
    remoteUndoRef,
    positionCountsRef,
  };
}