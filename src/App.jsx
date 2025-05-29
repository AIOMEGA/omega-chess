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

  const whitePieces = ['♙', '♘', '♗', '♖', '♕', '♔'];
const blackPieces = ['♟', '♞', '♝', '♜', '♛', '♚'];

const isSameTeam = (p1, p2) => {
  if (whitePieces.includes(p1) && whitePieces.includes(p2)) return true;
  if (blackPieces.includes(p1) && blackPieces.includes(p2)) return true;
  return false;
};

const handleClick = (row, col) => {
  const piece = board[row][col];

  // Clicked selected piece again? Deselect
  if (selected && selected.row === row && selected.col === col) {
    setSelected(null);
    return;
  }

  // Selecting a piece
  if (!selected) {
    if (piece !== '') {
      setSelected({ row, col });
    }
    return;
  }

  const selectedPiece = board[selected.row][selected.col];
  const targetPiece = board[row][col];

  // Prevent capturing own piece
  if (targetPiece && isSameTeam(selectedPiece, targetPiece)) {
    return;
  }

  // ✅ Capture or move
  const newBoard = board.map(r => [...r]);
  newBoard[row][col] = selectedPiece;
  newBoard[selected.row][selected.col] = '';
  setBoard(newBoard);
  setSelected(null);
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
