/* eslint react/prop-types: 0 */
import React from 'react';

function NodeView({ node, depth, currentNode, onSelect }) {
  const indent = { marginLeft: depth * 16 };
  const selected = node === currentNode;
  return (
    <div>
      <div
        style={{
          ...indent,
          cursor: 'pointer',
          fontWeight: selected ? 'bold' : 'normal',
        }}
        onClick={() => onSelect(node)}
      >
        {node.move?.notation || (node.parent ? '...' : 'root')}
      </div>
      {node.children.map((c) => (
        <NodeView
          key={c.id}
          node={c}
          depth={depth + 1}
          currentNode={currentNode}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default function MoveTreeView({ root, currentNode, onSelect }) {
  if (!root) return null;
  return <NodeView node={root} depth={0} currentNode={currentNode} onSelect={onSelect} />;
}