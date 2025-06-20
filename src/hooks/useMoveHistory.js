import { useState, useRef, useCallback, useEffect } from 'react';
import { cloneBoard, deepClone } from '../utils/helpers.js';
import { boardKey, checkThreefoldRepetition } from '../logic/gameStatus.js';

export default function useMoveHistory({
  initialBoard,
  mode,
  playerColor,
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
  const [canRedo, setCanRedo] = useState(false);

  const moveHistoryRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const remoteUndoRef = useRef(null);
  const recordMoveRef = externalRecordMoveRef ?? useRef(null);
  const positionCountsRef = useRef({});
  const redoCandidateRef = useRef(null);

  const getPathNodes = (node) => {
    const nodes = [];
    let n = node;
    while (n && n.move) {
      nodes.unshift(n);
      n = n.parent;
    }
    return nodes;
  };

  const updateActivePath = (node) => {
    const latestNodes = getPathNodes(latestNodeRef.current);
    const moves = latestNodes.map((n) => ({ id: n.id, ...n.move }));
    setMoveHistory(moves);
    moveHistoryRef.current = moves;
    const idx = latestNodes.indexOf(node);
    setHistoryIndex(idx);
    historyIndexRef.current = idx;
    currentNodeRef.current = node;
    const atLatest = node === latestNodeRef.current;
    setCanRedo(!atLatest || node.children.length > 0);
  };

  // --- move tree state ---
  const nextNodeIdRef = useRef(0);
  const rootNodeRef = useRef({
    id: nextNodeIdRef.current++,
    move: null,
    parent: null,
    children: [],
    timestamp: Date.now(),
  });
  const latestNodeRef = useRef(rootNodeRef.current);
  const currentNodeRef = useRef(rootNodeRef.current);
  const nodeMapRef = useRef({ [rootNodeRef.current.id]: rootNodeRef.current });
  const removeNode = (node) => {
    const p = node.parent;
    if (p) {
      p.children = p.children.filter((c) => c !== node);
    }
    delete nodeMapRef.current[node.id];
  };

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
      const parent = forcePlay ? latestNodeRef.current : currentNodeRef.current;

      if (redoCandidateRef.current) {
        removeNode(redoCandidateRef.current);
        redoCandidateRef.current = null;
      }

      const node = {
        id: nextNodeIdRef.current++,
        move,
        parent,
        children: [],
        timestamp: Date.now(),
      };
      parent.children.push(node);
      nodeMapRef.current[node.id] = node;
      latestNodeRef.current = node;

      updateActivePath(node);

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

        const repeated = checkThreefoldRepetition(
          positionCountsRef,
          move.board,
          move.turn === 'white' ? 'black' : 'white',
          move.castlingRights,
          move.enPassantTarget
        );
        if (repeated) {
          setDrawInfo({ type: 'threefold', message: 'Draw by threefold repetition.' });
        }
      }
    },
    [mode, analysisHistory, analysisIndex, sendMove, suppressRef, setHalfmoveClock, setDrawInfo]
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
    const current = currentNodeRef.current;
    if (current === rootNodeRef.current) return;

    const parent = current.parent;

    if (parent && parent.move) {
      setBoard(cloneBoard(parent.move.board));
      setTurn(parent.move.turn === 'white' ? 'black' : 'white');
      if (parent.move.kingState) setKingState(deepClone(parent.move.kingState));
      if (parent.move.castlingRights) setCastlingRights(deepClone(parent.move.castlingRights));
      setEnPassantTarget(parent.move.enPassantTarget || null);
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
    const isOwnLast = current === latestNodeRef.current && current.move?.turn === playerColor;

    if (isOwnLast) {
        latestNodeRef.current = parent;
        currentNodeRef.current = parent;
        redoCandidateRef.current = current;
        updateActivePath(parent);
        setReviewMode(false);
        reviewModeRef.current = false;
        if (!suppressRef.current) {
            sendUndo?.();
          }
        } else {
          currentNodeRef.current = parent;
          updateActivePath(parent);
          setReviewMode(true);
          reviewModeRef.current = true;
        }
    }, [mode, analysisIndex, analysisHistory, analysisSavedRef, setBoard, setTurn, setKingState, setCastlingRights, setEnPassantTarget, setAnalysisIndex, setReviewMode, initialBoard, playerColor, sendUndo, suppressRef]);

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

    const current = currentNodeRef.current;
    let nextNode = null;
    const candidate = redoCandidateRef.current;
    const useCandidate = candidate && candidate.parent === current;
    if (useCandidate) {
      nextNode = candidate;
    } else if (current.children.length > 0) {
      const path = [];
      let n = latestNodeRef.current;
      while (n) {
        path.unshift(n);
        n = n.parent;
      }
      const idx = path.indexOf(current);
      if (idx !== -1 && idx < path.length - 1) {
        nextNode = path[idx + 1];
      } else {
        nextNode = current.children[0];
      }
    }

    if (!nextNode || !nextNode.move) return;

    setBoard(cloneBoard(nextNode.move.board));
    setTurn(nextNode.move.turn === 'white' ? 'black' : 'white');
    if (nextNode.move.kingState) setKingState(deepClone(nextNode.move.kingState));
    if (nextNode.move.castlingRights) setCastlingRights(deepClone(nextNode.move.castlingRights));
    setEnPassantTarget(nextNode.move.enPassantTarget || null);

    if (useCandidate) {
        latestNodeRef.current = nextNode;
        redoCandidateRef.current = null;
        if (!suppressRef.current) {
            sendMove?.(nextNode.move);
        }
    }

    updateActivePath(nextNode);

    const reviewing = nextNode !== latestNodeRef.current;
    setReviewMode(reviewing);
    reviewModeRef.current = reviewing;
}, [mode, analysisIndex, analysisHistory, setBoard, setTurn, setKingState, setCastlingRights, setEnPassantTarget, setAnalysisIndex, setReviewMode]);
  
  const handleRemoteUndo = useCallback(() => {
    const latest = latestNodeRef.current;
    if (latest === rootNodeRef.current) return;

    const parent = latest.parent;
    parent.children = parent.children.filter((c) => c !== latest);
    delete nodeMapRef.current[latest.id];
    latestNodeRef.current = parent;

    if (parent && parent.move) {
      setBoard(cloneBoard(parent.move.board));
      setTurn(parent.move.turn === 'white' ? 'black' : 'white');
      if (parent.move.kingState) setKingState(deepClone(parent.move.kingState));
      if (parent.move.castlingRights) setCastlingRights(deepClone(parent.move.castlingRights));
      setEnPassantTarget(parent.move.enPassantTarget || null);
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

    updateActivePath(parent);
    setReviewMode(false);
    reviewModeRef.current = false;
    }, [initialBoard, setBoard, setTurn, setKingState, setCastlingRights, setEnPassantTarget, setReviewMode]);

  const resetHistory = useCallback(() => {
    nextNodeIdRef.current = 0;
    const root = {
      id: nextNodeIdRef.current++,
      move: null,
      parent: null,
      children: [],
      timestamp: Date.now(),
    };
    rootNodeRef.current = root;
    latestNodeRef.current = root;
    currentNodeRef.current = root;
    nodeMapRef.current = { [root.id]: root };
    setMoveHistory([]);
    moveHistoryRef.current = [];
    setHistoryIndex(-1);
    historyIndexRef.current = -1;
    setCanRedo(false);
  }, []);

    const jumpToMove = useCallback(
    (nodeId) => {
        if (mode === 'analysis') {
        const move = analysisHistory[nodeId];
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
            setAnalysisIndex(nodeId);
            return;
        }

        const node = nodeMapRef.current[nodeId];
      if (!node) return;

      if (node.move) {
        setBoard(cloneBoard(node.move.board));
        setTurn(node.move.turn === 'white' ? 'black' : 'white');
        if (node.move.kingState) setKingState(deepClone(node.move.kingState));
        if (node.move.castlingRights) setCastlingRights(deepClone(node.move.castlingRights));
        setEnPassantTarget(node.move.enPassantTarget || null);
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
        updateActivePath(node);

        const reviewing = node !== latestNodeRef.current;
        setReviewMode(reviewing);
        reviewModeRef.current = reviewing;
    },
    [mode, analysisHistory, analysisSavedRef, initialBoard, setBoard, setTurn, setKingState, setCastlingRights, setEnPassantTarget, setAnalysisIndex, setReviewMode, reviewModeRef]
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
    canRedo,
    resetHistory,
  };
}