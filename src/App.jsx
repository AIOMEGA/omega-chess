import { useState } from 'react';
import './App.css';

const BOARD_SIZE = 8;

// Unicode pieces (♙♘♗♖♕♔ / ♟♞♝♜♛♚)
const initialBoard = [
  ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
  ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
  [ '',  '',  '',  '',  '',  '',  '',  ''],
  [ '',  '',  '',  '',  '',  '',  '',  ''],
  [ '',  '',  '',  '',  '',  '',  '',  ''],
  [ '',  '',  '',  '',  '',  '',  '',  ''],
  ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
  ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
];

const pieceImages = {
  '♙': 'wP.svg',
  '♟': 'bP.svg',
  '♘': 'wN.svg',
  '♞': 'bN.svg',
  '♖': 'wR.svg',
  '♜': 'bR.svg',
  '♗': 'wB.svg',
  '♝': 'bB.svg',
  '♕': 'wQ.svg',
  '♛': 'bQ.svg',
  '♔': 'wK.svg',
  '♚': 'bK.svg',
};


function App() {
  const [board, setBoard] = useState(initialBoard);
  const [selected, setSelected] = useState(null);

  const handleClick = (row, col) => {
    const piece = board[row][col];

    if (selected) {
      // Move the piece if clicked on a different square
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = board[selected.row][selected.col];
      newBoard[selected.row][selected.col] = '';
      setBoard(newBoard);
      setSelected(null);
    } else if (piece !== '') {
      setSelected({ row, col });
    }
  };

  return (
    <div className="board">
      {board.map((rowArr, row) => (
        <div key={row} className="row">
          {rowArr.map((piece, col) => {
            const isDark = (row + col) % 2 === 1;
            const isSelected = selected?.row === row && selected?.col === col;

            return (
              <div
                key={col}
                className={`square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleClick(row, col)}
              >
                {piece && (
  <img
    src={`/src/assets/pieces/${pieceImages[piece]}`}
    alt={piece}
    style={{ width: '80%', height: '80%' }}
  />
)}

              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default App;
