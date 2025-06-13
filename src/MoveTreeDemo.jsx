/* eslint react/prop-types: 0 */
import React from 'react';
import useMoveTree from './useMoveTree';
import MoveTreeView from './MoveTreeView.jsx';

export default function MoveTreeDemo() {
  const initial = {
    board: { count: 0 },
    turn: 'white',
    kingState: {},
    castlingRights: {},
    enPassantTarget: null,
  };

  const {
    root,
    currentNode,
    analysisRoot,
    analysisNode,
    mode,
    recordMove,
    jumpToNode,
    undo,
    redo,
    startAnalysis,
    exitAnalysis,
  } = useMoveTree(initial);

  const activeNode = mode === 'analysis' ? analysisNode : currentNode;
  const activeRoot = mode === 'analysis' ? analysisRoot : root;

  const addMove = () => {
    const count = activeNode.board.count + 1;
    recordMove({
      board: { count },
      turn: activeNode.turn === 'white' ? 'black' : 'white',
      kingState: {},
      castlingRights: {},
      enPassantTarget: null,
      move: { notation: `m${count}` },
    });
  };

  return (
    <div>
      <div>Mode: {mode}</div>
      <button onClick={addMove}>Add Move</button>
      <button onClick={undo}>Undo</button>
      <button onClick={() => redo(0)}>Redo</button>
      <button onClick={startAnalysis}>Start Analysis</button>
      <button onClick={exitAnalysis}>Exit Analysis</button>
      <MoveTreeView root={activeRoot} currentNode={activeNode} onSelect={jumpToNode} />
    </div>
  );
}