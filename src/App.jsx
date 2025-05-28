// src/App.jsx
import { useState } from 'react';
import './App.css';

const BOARD_SIZE = 8;

function App() {
  const [selected, setSelected] = useState(null);

  const handleClick = (row, col) => {
    if (selected && selected.row === row && selected.col === col) {
      setSelected(null); // Deselect
    } else {
      setSelected({ row, col }); // Select
    }
  };

  return (
    <div className="board">
      {Array.from({ length: BOARD_SIZE }).map((_, row) => (
        <div key={row} className="row">
          {Array.from({ length: BOARD_SIZE }).map((_, col) => {
            const isDark = (row + col) % 2 === 1;
            const isSelected = selected?.row === row && selected?.col === col;
            return (
              <div
                key={col}
                className={`square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleClick(row, col)}
              >
                {/* Future: put piece here */}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default App;
