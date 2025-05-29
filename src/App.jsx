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

function getValidPawnMoves(board, row, col, piece, enPassantTarget) {
  const isWhite = piece === '♙';
  const isBlack = piece === '♟';

  const whitePieces = ['♙', '♘', '♗', '♖', '♕', '♔'];
  const blackPieces = ['♟', '♞', '♝', '♜', '♛', '♚'];
  const validMoves = [];

  const forward = isWhite ? -1 : 1;
  const startRow = isWhite ? 6 : 1;

  // All 8 directions
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1],
  ];

  for (let [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) continue;

    const target = board[newRow][newCol];

    const isDiagonal = Math.abs(dr) === 1 && Math.abs(dc) === 1;

    if (target === '') {
      // Empty square — allow in any direction
      validMoves.push([newRow, newCol]);
    } else if (
      isDiagonal && (
        (isWhite && blackPieces.includes(target)) ||
        (isBlack && whitePieces.includes(target))
      )
    ) {
      // Capture diagonally only
      validMoves.push([newRow, newCol]);
    }
  }

  // 2-square forward move if not blocked
  const oneStep = row + forward;
  const twoStep = row + 2 * forward;
  if (row === startRow &&
      board[oneStep]?.[col] === '' &&
      board[twoStep]?.[col] === '') {
    validMoves.push([twoStep, col]);
  }

  // En passant
  for (let dc of [-1, 1]) {
    const newRow = row + forward;
    const newCol = col + dc;
    if (enPassantTarget &&
        enPassantTarget.row === newRow &&
        enPassantTarget.col === newCol) {
      validMoves.push([newRow, newCol]);
    }
  }

  return validMoves;
}

function getValidRookMoves(board, row, col, piece) {
  const isWhite = piece === '♖';
  const isBlack = piece === '♜';

  const whitePieces = ['♙', '♘', '♗', '♖', '♕', '♔'];
  const blackPieces = ['♟', '♞', '♝', '♜', '♛', '♚'];

  const validMoves = [];
  const directions = [
    [-1, 0], // up
    [1, 0],  // down
    [0, -1], // left
    [0, 1],  // right
  ];

  for (const [dr, dc] of directions) {
    let r = row + dr;
    let c = col + dc;
    let blockerFound = false;

    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const target = board[r][c];

      if (!blockerFound) {
        if (target === '') {
          validMoves.push([r, c]); // normal movement
        } else {
          const isEnemy = (isWhite && blackPieces.includes(target)) || (isBlack && whitePieces.includes(target));
          if (isEnemy) {
            validMoves.push([r, c]); // capture the blocker
          }

          blockerFound = true; // now check one square past
        }
      } else {
        const behindPiece = board[r][c];
        const isEnemy = (isWhite && blackPieces.includes(behindPiece)) || (isBlack && whitePieces.includes(behindPiece));

        if (behindPiece === '' || isEnemy) {
          validMoves.push([r, c]); // jump move: land only directly behind
        }

        break; // only allowed to hop 1 piece
      }

      r += dr;
      c += dc;
    }
  }

  return validMoves;
}

function getSquareCenter(row, col, squareSize = 105) {
  const x = col * squareSize + squareSize / 2;
  const y = row * squareSize + squareSize / 2;
  return { x, y };
}

function getValidQueenMoves(board, row, col, piece) {
  const isWhite = piece === '♕';
  const isBlack = piece === '♛';

  const whitePieces = ['♙', '♘', '♗', '♖', '♕', '♔'];
  const blackPieces = ['♟', '♞', '♝', '♜', '♛', '♚'];
  const validMoves = [];

  const isEnemy = (target) =>
    isWhite ? blackPieces.includes(target) : whitePieces.includes(target);

  const isBlocked = (r, c) => board[r][c] !== '';

  function hasLineOfSight(toRow, toCol) {
    const startX = col + 0.5;
    const startY = row + 0.5;
    const endX = toCol + 0.5;
    const endY = toRow + 0.5;
  
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance * 10); // finer resolution = more accurate
  
    let prevTile = `${Math.floor(startY)}-${Math.floor(startX)}`;
  
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = startX + dx * t;
      const y = startY + dy * t;
  
      const tileRow = Math.floor(y);
      const tileCol = Math.floor(x);
      const tileId = `${tileRow}-${tileCol}`;
  
      if (tileId !== prevTile) {
        if (
          (tileRow !== row || tileCol !== col) &&        // not Queen’s own square
          (tileRow !== toRow || tileCol !== toCol) &&    // not destination square
          board[tileRow]?.[tileCol] !== ''               // something in the way
        ) {
          return false;
        }        
        prevTile = tileId;
      }
    }
  
    return true;
  }
  
  
  

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (r === row && c === col) continue;

      if (hasLineOfSight(r, c)) {
        const target = board[r][c];
        if (target === '' || isEnemy(target)) {
          validMoves.push([r, c]);
        }
      }
    }
  }

  return validMoves;
}


function getValidKnightMoves(board, row, col, piece) {
  const isWhite = piece === '♘';
  const isBlack = piece === '♞';

  const whitePieces = ['♙', '♘', '♗', '♖', '♕', '♔'];
  const blackPieces = ['♟', '♞', '♝', '♜', '♛', '♚'];
  const validMoves = [];

  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue; // skip current square
      if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) continue; // skip 3x3 core

      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;

      const target = board[r][c];
      if (target === '') {
        validMoves.push([r, c]);
      } else {
        const isEnemy = isWhite
          ? blackPieces.includes(target)
          : whitePieces.includes(target);
        if (isEnemy) {
          validMoves.push([r, c]);
        }
      }
    }
  }

  return validMoves;
}



function getValidBishopMoves(board, row, col, piece) {
  const isWhite = piece === '♗';
  const isBlack = piece === '♝';

  const whitePieces = ['♙', '♘', '♗', '♖', '♕', '♔'];
  const blackPieces = ['♟', '♞', '♝', '♜', '♛', '♚'];
  const validMoves = [];

  const isEnemy = (target) =>
    isWhite ? blackPieces.includes(target) : whitePieces.includes(target);

  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1],
  ];

  // Bishop-style infinite diagonals (4 directions only)
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const target = board[r][c];
      if (target === '') {
        validMoves.push([r, c]);
      } else {
        if (isEnemy(target)) validMoves.push([r, c]);
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // King-style 1-tile in any direction (orthogonal + diagonal)
  for (const [dr, dc] of directions) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const target = board[r][c];
      if (target === '' || isEnemy(target)) {
        validMoves.push([r, c]);
      }
    }
  }

  return validMoves;
}



function App() {
  const [board, setBoard] = useState(initialBoard);
  const [selected, setSelected] = useState(null);
  const [enPassantTarget, setEnPassantTarget] = useState(null); // e.g. { row: 3, col: 4 }

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

    let validMoves = [];


    // Movement logic

    if (selectedPiece === '♙' || selectedPiece === '♟') {
      validMoves = getValidPawnMoves(board, selected.row, selected.col, selectedPiece, enPassantTarget);
    }
    if (selectedPiece === '♖' || selectedPiece === '♜') {
      validMoves = getValidRookMoves(board, selected.row, selected.col, selectedPiece);
    }
    if (selectedPiece === '♕' || selectedPiece === '♛') {
      validMoves = getValidQueenMoves(board, selected.row, selected.col, selectedPiece);
    }
    if (selectedPiece === '♘' || selectedPiece === '♞') {
      validMoves = getValidKnightMoves(board, selected.row, selected.col, selectedPiece);
    }
    if (selectedPiece === '♗' || selectedPiece === '♝') {
      validMoves = getValidBishopMoves(board, selected.row, selected.col, selectedPiece);
    }
    

    
    const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
    
    if (isValidMove) {
      const newBoard = board.map(r => [...r]);
      const movingPawn = selectedPiece;
    
      // En passant capture
      if (
        (movingPawn === '♙' || movingPawn === '♟') &&
        enPassantTarget &&
        row === enPassantTarget.row &&
        col === enPassantTarget.col
      ) {
        const captureRow = selected.row;
        newBoard[captureRow][col] = ''; // Remove the passed pawn
      }
    
      // Set new en passant target
      const diff = Math.abs(row - selected.row);
      if ((movingPawn === '♙' || movingPawn === '♟') && diff === 2) {
        setEnPassantTarget({
          row: (row + selected.row) / 2,
          col: col
        });
      } else {
        setEnPassantTarget(null);
      }
    
      newBoard[row][col] = selectedPiece;
      newBoard[selected.row][selected.col] = '';
      setBoard(newBoard);
    }
    setSelected(null);
    
    

  };

  

  return (
    <div style={{ position: 'relative', width: '840px', height: '840px' }}>
      {/* <svg
        width="840"
        height="840"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >

        {selected &&
          (board[selected.row][selected.col] === '♕' ||
            board[selected.row][selected.col] === '♛') &&
          getValidQueenMoves(board, selected.row, selected.col, board[selected.row][selected.col]).map(
            ([r, c], i) => {
              const start = getSquareCenter(selected.row, selected.col);
              const end = getSquareCenter(r, c);
              return (
                <line
                  key={i}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="lime"
                  strokeWidth="3"
                  strokeOpacity="0.6"
                />
              );
            }
          )}
      </svg> */}

      {/* Your board rendering stays the same below */}
      <div className="board" style={{ zIndex: 1, position: 'relative' }}>
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
    </div>
    
  );
}

export default App;
