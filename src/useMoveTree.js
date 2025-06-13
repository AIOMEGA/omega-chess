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

  const [root] = useState(() => createNode(initialState, null));
  const [currentNode, setCurrentNode] = useState(root);
  const latestRef = useRef(root);

  const [analysisRoot, setAnalysisRoot] = useState(null);
  const [analysisNode, setAnalysisNode] = useState(null);
  const analysisBaseRef = useRef(null);

  const [mode, setModeState] = useState('play');
  const [reviewMode, setReviewMode] = useState(false);

  const updateReview = useCallback(
    (node) => {
      if (mode === 'analysis') return;
      const reviewing = node !== latestRef.current;
      setReviewMode(reviewing);
      setModeState(reviewing ? 'review' : 'play');
    },
    [mode]
  );

  const jumpToNode = useCallback(
    (node) => {
      if (!node) return null;
      if (mode === 'analysis') {
        setAnalysisNode(node);
      } else {
        setCurrentNode(node);
        updateReview(node);
      }
      return node;
    },
    [mode, updateReview]
  );

  const recordMove = useCallback(
    (state) => {
      const node = mode === 'analysis' ? analysisNode : currentNode;
      const newNode = createNode(state, state.move, node);
      node.children.push(newNode);

      if (mode === 'analysis') {
        setAnalysisNode(newNode);
      } else {
        setCurrentNode(newNode);
        latestRef.current = newNode;
        updateReview(newNode);
      }
      return newNode;
    },
    [mode, currentNode, analysisNode, updateReview]
  );

  const undo = useCallback(() => {
    const node = mode === 'analysis' ? analysisNode : currentNode;
    if (!node.parent) return node;
    return jumpToNode(node.parent);
  }, [mode, currentNode, analysisNode, jumpToNode]);

  const redo = useCallback(
    (index = 0) => {
      const node = mode === 'analysis' ? analysisNode : currentNode;
      const child = node.children[index];
      if (child) return jumpToNode(child);
      return node;
    },
    [mode, currentNode, analysisNode, jumpToNode]
  );

  const startAnalysis = useCallback(
    (state) => {
      if (mode === 'analysis') return;
      analysisBaseRef.current = currentNode;
      const rootNode = createNode(state, null);
      setAnalysisRoot(rootNode);
      setAnalysisNode(rootNode);
      setModeState('analysis');
    },
    [mode, currentNode]
  );

  const exitAnalysis = useCallback(() => {
    if (mode !== 'analysis') return;
    setAnalysisRoot(null);
    setAnalysisNode(null);
    setModeState('play');
    const base = analysisBaseRef.current || currentNode;
    jumpToNode(base);
  }, [mode, jumpToNode, currentNode]);

  const removeLatest = useCallback(() => {
    const latest = latestRef.current;
    if (!latest.parent) return latest;
    const parent = latest.parent;
    parent.children = parent.children.filter((c) => c !== latest);
    latestRef.current = parent;
    return jumpToNode(parent);
  }, [jumpToNode]);

  const setMode = useCallback((m) => {
    setModeState(m);
    if (m !== 'review') setReviewMode(false);
  }, []);

  return {
    root,
    currentNode,
    analysisRoot,
    analysisNode,
    mode,
    reviewMode,
    recordMove,
    jumpToNode,
    undo,
    redo,
    startAnalysis,
    exitAnalysis,
    removeLatest,
    getLatestNode: () => latestRef.current,
    setMode,
  };
}