import { useState, useRef, useCallback } from 'react';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

export default function useMoveTree(initialState) {
  const idRef = useRef(0);
  const createNode = (state, move, parent = null) => ({
    id: idRef.current++,
    board: clone(state.board),
    turn: state.turn,
    kingState: clone(state.kingState),
    castlingRights: clone(state.castlingRights),
    enPassantTarget: state.enPassantTarget,
    move,
    parent,
    children: [],
  });

  const [root] = useState(() => createNode(initialState, null, null));
  const [currentNode, setCurrentNode] = useState(root);
  const latestNodeRef = useRef(root);

  const [analysisRoot, setAnalysisRoot] = useState(null);
  const [analysisNode, setAnalysisNode] = useState(null);
  const analysisBaseRef = useRef(null);

  const [board, setBoard] = useState(clone(initialState.board));
  const [turn, setTurn] = useState(initialState.turn);
  const [kingState, setKingState] = useState(clone(initialState.kingState));
  const [castlingRights, setCastlingRights] = useState(
    clone(initialState.castlingRights)
  );
  const [enPassantTarget, setEnPassantTarget] = useState(
    initialState.enPassantTarget
  );

  const [mode, setModeState] = useState('standard');
  const [reviewMode, setReviewMode] = useState(false);

  const updateReview = useCallback(
    (node) => {
      if (mode === 'analysis') return;
      const reviewing = node !== latestNodeRef.current;
      setReviewMode(reviewing);
      setModeState(reviewing ? 'review' : 'standard');
    },
    [mode]
  );

  const jumpToNode = useCallback(
    (node) => {
      if (!node) return;
      setBoard(clone(node.board));
      setTurn(node.turn);
      setKingState(clone(node.kingState));
      setCastlingRights(clone(node.castlingRights));
      setEnPassantTarget(node.enPassantTarget);

      if (mode === 'analysis') {
        setAnalysisNode(node);
      } else {
        setCurrentNode(node);
        updateReview(node);
      }
    },
    [mode, updateReview]
  );

  const recordMove = useCallback(
    (moveData) => {
      const node = mode === 'analysis' ? analysisNode : currentNode;
      const newNode = createNode(moveData, moveData.move, node);
      node.children.push(newNode);

      if (mode === 'analysis') {
        setAnalysisNode(newNode);
      } else {
        setCurrentNode(newNode);
        latestNodeRef.current = newNode;
        updateReview(newNode);
      }
      jumpToNode(newNode);
    },
    [mode, currentNode, analysisNode, jumpToNode, updateReview]
  );

  const undo = useCallback(() => {
    const node = mode === 'analysis' ? analysisNode : currentNode;
    if (!node.parent) return;
    jumpToNode(node.parent);
  }, [mode, currentNode, analysisNode, jumpToNode]);

  const redo = useCallback(
    (index = 0) => {
      const node = mode === 'analysis' ? analysisNode : currentNode;
      const child = node.children[index];
      if (child) jumpToNode(child);
    },
    [mode, currentNode, analysisNode, jumpToNode]
  );

  const startAnalysis = useCallback(() => {
    if (mode === 'analysis') return;
    analysisBaseRef.current = currentNode;
    const state = {
      board,
      turn,
      kingState,
      castlingRights,
      enPassantTarget,
    };
    const rootNode = createNode(state, null, null);
    setAnalysisRoot(rootNode);
    setAnalysisNode(rootNode);
    setModeState('analysis');
  }, [mode, currentNode, board, turn, kingState, castlingRights, enPassantTarget]);

  const exitAnalysis = useCallback(() => {
    if (mode !== 'analysis') return;
    setAnalysisRoot(null);
    setAnalysisNode(null);
    setModeState('standard');
    const base = analysisBaseRef.current || currentNode;
    jumpToNode(base);
  }, [mode, jumpToNode, currentNode]);

  const setMode = useCallback((m) => {
    setModeState(m);
    if (m !== 'review') setReviewMode(false);
  }, []);

  return {
    root,
    currentNode,
    analysisRoot,
    analysisNode,
    board,
    turn,
    kingState,
    castlingRights,
    enPassantTarget,
    mode,
    reviewMode,
    setMode,
    recordMove,
    jumpToNode,
    undo,
    redo,
    startAnalysis,
    exitAnalysis,
  };
}