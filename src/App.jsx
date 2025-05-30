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
    const squareSize = 105;
  
    const startX = col * squareSize + 52.5 + 4;
    const startY = row * squareSize + 52.5 + 4;
    const endX = toCol * squareSize + 52.5 + 4;
    const endY = toRow * squareSize + 52.5 + 4;
  
    const dx = endX - startX;
    const dy = endY - startY;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 48); // higher = smoother
  
    let prevTile = null;
  
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = startX + dx * t;
      const y = startY + dy * t;
  
      const tileRow = Math.floor(y / squareSize);
      const tileCol = Math.floor(x / squareSize);
      const tileId = `${tileRow}-${tileCol}`;
  
      if (
        tileId !== prevTile &&
        !(tileRow === row && tileCol === col) &&
        !(tileRow === toRow && tileCol === toCol)
      ) {
        if (board[tileRow]?.[tileCol] !== '') return false;
      }
  
      prevTile = tileId;
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

function getValidKingMoves(board, row, col, piece, kingState) {
  const isWhite = piece === '♔';
  const isBlack = piece === '♚';

  const whitePieces = ['♙', '♘', '♗', '♖', '♕', '♔'];
  const blackPieces = ['♟', '♞', '♝', '♜', '♛', '♚'];
  const isEnemy = (target) =>
    isWhite ? blackPieces.includes(target) : whitePieces.includes(target);
  const isSameTeam = (target) =>
    isWhite ? whitePieces.includes(target) : blackPieces.includes(target);

  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1],
  ];

  const validMoves = [];

  for (const [dr, dc] of directions) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;

    const target = board[r][c];
    if (target === '' || isEnemy(target)) {
      validMoves.push([r, c]);
    }
  }

  // Summoning check
  const homeRow = isWhite ? 7 : 0;
  const enemyRow = isWhite ? 0 : 7;

  const canSummon =
    row === enemyRow &&
    !kingState.hasSummoned &&
    (!kingState.needsReturn || kingState.returnedHome);

  if (canSummon) {
    for (const offset of [-1, 1]) {
      const c = col + offset;
      if (c >= 0 && c < 8 && board[row][c] === '') {
        validMoves.push(['summon', row, c]); // Special indicator
      }
    }
  }

  return validMoves;
}

function performSummon(board, row, col, color, pieceType = '♕') {
  const newBoard = board.map(r => [...r]);
  newBoard[row][col] = pieceType;
  return newBoard;
}

function performPromotion(board, row, col, fromRow, fromCol, color, piece) {
  const newBoard = JSON.parse(JSON.stringify(board));
  newBoard[fromRow][fromCol] = '';
  newBoard[row][col] = piece;
  return newBoard;
}

function App() {
  const [board, setBoard] = useState(initialBoard);
  const [selected, setSelected] = useState(null);
  const [enPassantTarget, setEnPassantTarget] = useState(null); // e.g. { row: 3, col: 4 }

  const [kingState, setKingState] = useState({
    white: { hasSummoned: false, needsReturn: false, returnedHome: false },
    black: { hasSummoned: false, needsReturn: false, returnedHome: false },
  });
  
  const [showSummonMenu, setShowSummonMenu] = useState(null); // { row, col, side }
  const [pendingSummonPiece, setPendingSummonPiece] = useState(null);

  const [summonOptions, setSummonOptions] = useState(null); // e.g., { row: 0, col: 4, color: 'black' }

  const [promotionOptions, setPromotionOptions] = useState(null); // { row, col, color, fromRow, fromCol }

  const [lastKingMove, setLastKingMove] = useState(null); // { fromRow, fromCol, toRow, toCol }

  
  const pieceImagesMap = {
    white: {
      '♕': 'wQ.svg',
      '♘': 'wN.svg',
      '♖': 'wR.svg',
      '♗': 'wB.svg',
    },
    black: {
      '♛': 'bQ.svg',
      '♞': 'bN.svg',
      '♜': 'bR.svg',
      '♝': 'bB.svg',
    }
  };  

  const summonSymbols =
  summonOptions?.color === 'white'
    ? ['♕', '♘', '♖', '♗']
    : ['♛', '♞', '♜', '♝'];

  const whitePieces = ['♙', '♘', '♗', '♖', '♕', '♔'];
  const blackPieces = ['♟', '♞', '♝', '♜', '♛', '♚'];

  const isSameTeam = (p1, p2) => {
    if (whitePieces.includes(p1) && whitePieces.includes(p2)) return true;
    if (blackPieces.includes(p1) && blackPieces.includes(p2)) return true;
    return false;
  };

  const handleClick = (row, col) => {
    const piece = board[row][col];
    const color = piece === '♔' ? 'white' : 'black';
    const currentState = kingState[color];  

    // Close open promotion GUIs if open
    if (promotionOptions) {
      setPromotionOptions(null);
      return;
    }

    // Close open summon GUIs if open
    if (summonOptions) {
      setSummonOptions(null);
      return;
    }    

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
      setSelected({ row, col });
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
    if (selectedPiece === '♔' || selectedPiece === '♚') {
      validMoves = getValidKingMoves(board, selected.row, selected.col, selectedPiece, kingState);
    }
    

    
    const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
    
    if (isValidMove) {
      const newBoard = board.map(r => [...r]);
      const movingPawn = selectedPiece;
    
      const movedPiece = board[selected.row][selected.col];
      const isPawn = movedPiece === '♙' || movedPiece === '♟';
      const targetRow = row;

      const isWhitePromotion = isPawn && movedPiece === '♙' && targetRow === 0;
      const isBlackPromotion = isPawn && movedPiece === '♟' && targetRow === 7;

      if (selectedPiece === '♔' || selectedPiece === '♚') {
        setLastKingMove({
          fromRow: selected.row,
          fromCol: selected.col,
          toRow: row,
          toCol: col,
        });
      }      

      if (isWhitePromotion || isBlackPromotion) {
        setPromotionOptions({
          row,
          col,
          fromRow: selected.row,
          fromCol: selected.col,
          color: movedPiece === '♙' ? 'white' : 'black'
        });
        return;
      }

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

      // if (
      //   (selectedPiece === '♔' || selectedPiece === '♚') &&
      //   row === (selectedPiece === '♔' ? 0 : 7) &&
      //   !kingState[pieceColor].hasSummoned &&
      //   (!kingState[pieceColor].needsReturn || kingState[pieceColor].returnedHome)
      // ) {
      //   setSummonOptions({ row, col, color: pieceColor });
      // }
      

      if (selectedPiece === '♔' || selectedPiece === '♚') {
        const isWhite = selectedPiece === '♔';
        const homeRow = isWhite ? 7 : 0;
        const enemyRow = isWhite ? 0 : 7;
        const pieceColor = isWhite ? 'white' : 'black';

        const isBackHome = row === homeRow;

        // Perform summon GUI logic on the **new board**
        const updatedBoard = newBoard;

        if (
          row === enemyRow &&
          !kingState[pieceColor].hasSummoned &&
          (!kingState[pieceColor].needsReturn || kingState[pieceColor].returnedHome)
        ) {
          const potentialCols = [];

          const candidateCols = [-1, 1]
            .map(offset => col + offset)
            .filter(c => c >= 0 && c < 8);

          for (const c of candidateCols) {
            const neighbor = updatedBoard[row][c];
            const isFriendly = neighbor && isSameTeam(neighbor, pieceColor === 'white' ? '♙' : '♟');
            if (!isFriendly) {
              potentialCols.push(c);
            }
          }

          // Always include fromCol if it's adjacent and empty (for corner case fix)
          if (
            lastKingMove &&
            lastKingMove.toRow === row &&
            Math.abs(lastKingMove.fromCol - col) === 1 &&
            !potentialCols.includes(lastKingMove.fromCol)
          ) {
            const fromCol = lastKingMove.fromCol;
            if (fromCol >= 0 && fromCol < 8) {
              const pieceAtFromCol = updatedBoard[row][fromCol];
              const isFriendly = pieceAtFromCol && isSameTeam(pieceAtFromCol, pieceColor === 'white' ? '♙' : '♟');
              if (!isFriendly) {
                potentialCols.push(fromCol);
              }
            }
          }
        
          if (potentialCols.length > 0) {
            setSummonOptions({ row, col, color: pieceColor, cols: potentialCols });
          }
        }

        setKingState(prev => ({
          ...prev,
          [pieceColor]: {
            ...prev[pieceColor],
            returnedHome: isBackHome ? true : prev[pieceColor].returnedHome,
            hasSummoned: isBackHome ? false : prev[pieceColor].hasSummoned,
            needsReturn: isBackHome ? false : prev[pieceColor].needsReturn,
          }
        }));
      }
   
    }
    setSelected(null);
    
    

  };
  

  return (
    <div
      style={{ position: 'relative', width: '840px', height: '840px' }}
      onClick={() => {
        if (promotionOptions) {
          setPromotionOptions(null);
          setSelected(null); // <== Add this
        }
        if (summonOptions) {
          setSummonOptions(null);
          setSelected(null); // <== Add this
        }
      }}      
    >  
      <svg
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

        {selected && (() => {
          let validMoves = [];
          const piece = board[selected.row][selected.col];
          if (piece === '♙' || piece === '♟') validMoves = getValidPawnMoves(board, selected.row, selected.col, piece, enPassantTarget);
          else if (piece === '♖' || piece === '♜') validMoves = getValidRookMoves(board, selected.row, selected.col, piece);
          else if (piece === '♕' || piece === '♛') validMoves = getValidQueenMoves(board, selected.row, selected.col, piece);
          else if (piece === '♘' || piece === '♞') validMoves = getValidKnightMoves(board, selected.row, selected.col, piece);
          else if (piece === '♗' || piece === '♝') validMoves = getValidBishopMoves(board, selected.row, selected.col, piece);
          else if (piece === '♔' || piece === '♚') validMoves = getValidKingMoves(board, selected.row, selected.col, piece, kingState);

          return validMoves.map(([r, c], i) => {
            const target = board[r][c];
            const isEnemy = target && !isSameTeam(piece, target);
            const startX = selected.col * 105 + 52.5 + 4;
            const startY = selected.row * 105 + 52.5 + 4;
            const endX = c * 105 + 52.5 + 4;
            const endY = r * 105 + 52.5 + 4;
            if (isEnemy) {
              return (
              //   <line
              //   key={"line-" + i}
              //   x1={startX}
              //   y1={startY}
              //   x2={endX}
              //   y2={endY}
              //   stroke="lime"
              //   strokeWidth={3}
              //   strokeOpacity={0.6}
              // />

                <circle
                  key={"attack-" + i}
                  cx={c * 105 + 52.5 + 4}
                  cy={r * 105 + 52.5 + 4}
                  r={43}
                  fill="none"
                  stroke="black"
                  strokeWidth={10}
                  opacity="0.2"
                />
              );
            }
            return (
              // <line
              //   key={"line-" + i}
              //   x1={startX}
              //   y1={startY}
              //   x2={endX}
              //   y2={endY}
              //   stroke="lime"
              //   strokeWidth={3}
              //   strokeOpacity={0.6}
              // />
                
              <circle
                key={"move-" + i}
                cx={c * 105 + 52.5 + 4}
                cy={r * 105 + 52.5 + 4}
                r={15}
                fill="black"
                opacity="0.2"
              />
            );
          });
        })()}
      </svg>

      {summonOptions && (
        <div className="summon-ui" onClick={(e) => e.stopPropagation()}>
          {[summonOptions.col - 1, summonOptions.col + 1]
            .filter(c => {
              const neighborPiece = board[summonOptions.row]?.[c];
              if (!neighborPiece) return true;
              return !isSameTeam(neighborPiece, summonOptions.color === 'white' ? '♙' : '♟');
            })
            .filter(c => c >= 0 && c < 8) // prevent out-of-bounds
            .map((c) => (
              <div
                key={c}
                className="summon-column"
                style={{
                  left: `${c * 105 + 4}px`,
                  top: `${summonOptions.row * 105 - (summonOptions.color === 'black' ? 315 : 0)}px`,
                }}
              >
                {summonSymbols.map((symbol, i) => (
                  <img
                    key={i}
                    src={`/src/assets/pieces/${pieceImagesMap[summonOptions.color][symbol]}`}
                    alt={symbol}
                    style={{ width: '80px', height: '80px', margin: '5px', cursor: 'pointer' }}
                    onClick={() => {
                      const newBoard = performSummon(board, summonOptions.row, c, summonOptions.color, symbol);
                      setBoard(newBoard);
                      setKingState(prev => ({
                        ...prev,
                        [summonOptions.color]: {
                          hasSummoned: true,
                          needsReturn: true,
                          returnedHome: false,
                        }
                      }));
                      setSummonOptions(null);
                      setLastKingMove(null);
                    }}
                  />
                ))}
                <button onClick={(e) => { e.stopPropagation(); setSummonOptions(null); }}>X</button>
              </div>
            ))}
        </div>
      )}

      {promotionOptions && (
        <div className="summon-ui" onClick={(e) => e.stopPropagation()}>
          {[promotionOptions.col].map((c) => (
            <div
              key={c}
              className="summon-column"
              style={{
                left: `${c * 105 + 4}px`,
                top: `${promotionOptions.color === 'black' ? promotionOptions.row * 105 - 315 : promotionOptions.row * 105}px`,
              }}
            >
              {(promotionOptions.color === 'white' ? ['♕', '♘', '♖', '♗'] : ['♛', '♞', '♜', '♝']).map((symbol, i) => (
                <img
                  key={i}
                  src={`/src/assets/pieces/${pieceImagesMap[promotionOptions.color][symbol]}`}
                  alt={symbol}
                  style={{ width: '80px', height: '80px', margin: '5px', cursor: 'pointer' }}

                  onClick={() => {
                    const newBoard = performPromotion(
                      board,
                      promotionOptions.row,
                      promotionOptions.col,
                      promotionOptions.fromRow,
                      promotionOptions.fromCol,
                      promotionOptions.color,
                      symbol
                    );
                    setBoard(newBoard);
                    setPromotionOptions(null);
                    setSelected(null);
                  }}
                />
              ))}
              <button onClick={() => {
                setPromotionOptions(null);
                setSelected(null); // <== Add this
              }}>X</button>
            </div>
          ))}
        </div>
      )}


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
                  <div
                    className="label"
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: '7px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: isDark ? '#f0d9b5' : '#b58863',
                    }}>
                    {col === 0 ? 8 - row : ''}
                  </div>
                  <div
                    className="label"
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '10px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: isDark ? '#f0d9b5' : '#b58863',
                    }}>
                    {row === 7 ? String.fromCharCode(97 + col) : ''}
                  </div>
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
