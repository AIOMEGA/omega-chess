import { useState, useEffect, useRef } from 'react';
import './App.css';
import './assets/logo.png'
import { initialBoard, pieceImages } from './constants/pieces.js';
import useBroadcastChannel from './hooks/useBroadcastChannel.js';
import useMoveHistory from './hooks/useMoveHistory.js';
import boardHighlights from './utils/boardHighlights.js';
import PromotionOverlay from './components/PromotionOverlay.jsx';
import SummonOverlay from './components/SummonOverlay.jsx';
import {
  getValidPawnMoves,
  getValidRookMoves,
  getValidQueenMoves,
  getValidKnightMoves,
  getValidBishopMoves,
  getValidKingMoves,
  filterLegalMoves,
} from './logic/moveRules.js';
import {
  cloneBoard,
  deepClone,
  isWhitePiece,
  isBlackPiece,
  isSameTeam,
} from './utils/helpers.js';
import {
  hasAnyLegalMoves,
  isKingInCheck,
  boardKey,
} from './logic/gameStatus.js';

function App() {
  // Current board state as an 8x8 array of piece symbols
  const [board, setBoard] = useState(initialBoard);
  // If a pawn advanced two squares last move this holds the square that can be captured en passant
  const [enPassantTarget, setEnPassantTarget] = useState(null); // e.g. { row: 3, col: 4 }
  // Tracks each king's special summoning status
  const [kingState, setKingState] = useState({
    white: { hasSummoned: false, needsReturn: false, returnedHome: false },
    black: { hasSummoned: false, needsReturn: false, returnedHome: false },
  });
  // When a king reaches the back rank we show summoning UI using this state
  const [summonOptions, setSummonOptions] = useState(null); // e.g., { row: 0, col: 4, color: 'black' }
  // UI state for pawn promotion menu
  const [promotionOptions, setPromotionOptions] = useState(null); // { row, col, color, fromRow, fromCol }
  // Track whether each side may still castle on either side
  const [castlingRights, setCastlingRights] = useState({
    white: { kingSide: true, queenSide: true },
    black: { kingSide: true, queenSide: true },
  });
  // Remember the last king move to support canceling summons
  const [lastKingMove, setLastKingMove] = useState(null); // { fromRow, fromCol, toRow, toCol }
  // Whose turn it is to move
  const [turn, setTurn] = useState('white');
  // Display helper text such as "check" notices
  const [statusMessage, setStatusMessage] = useState('');
  // Holds winner color when checkmate occurs
  const [checkmateInfo, setCheckmateInfo] = useState(null); // { winner: 'white'|'black' }

  // Information when a draw is reached
  const [drawInfo, setDrawInfo] = useState(null); // { type, message }
  // Winner color when a resignation happens
  const [resignInfo, setResignInfo] = useState(null); // { winner: 'white'|'black' }
  // Counts half-moves since the last capture or pawn move
  const [, setHalfmoveClock] = useState(0); // half-move counter for fifty-move rule

  const suppressRef = useRef(false);
  const recordMoveRef = useRef(null); // holds latest recordMove implementation
  const modeRef = useRef('play');
  const [reviewMode, setReviewMode] = useState(false); // true when viewing past moves
  const reviewModeRef = useRef(false); // latest review mode state

  const coordLabel = (row, col) => {
    return `${String.fromCharCode(97 + col)}${8 - row}`;
  };
  
  // --- Analysis mode ---
  const [playerColor, setPlayerColor] = useState('white');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlColor = params.get('color');
    if (urlColor === 'white' || urlColor === 'black') {
      setPlayerColor(urlColor);
      localStorage.setItem('playerColor', urlColor);
      return;
    }
    const stored = localStorage.getItem('playerColor');
    if (stored === 'white' || stored === 'black') {
      setPlayerColor(stored);
      return;
    }
    const random = Math.random() < 0.5 ? 'white' : 'black';
    setPlayerColor(random);
    localStorage.setItem('playerColor', random);
  }, []);
  const [mode, setMode] = useState('play'); // 'play' or 'analysis'
  // Analysis move history managed by useMoveHistory hook
  const analysisSavedRef = useRef(null);

  const activateAnalysis = (sel) => {
    if (mode === 'analysis') return;
    analysisSavedRef.current = {
      board: cloneBoard(board),
      turn,
      kingState: deepClone(kingState),
      enPassantTarget,
      castlingRights: deepClone(castlingRights),
      lastKingMove,
    };
    setBoard(cloneBoard(board));
    setKingState(deepClone(kingState));
    setCastlingRights(deepClone(castlingRights));
    setEnPassantTarget(enPassantTarget ? { ...enPassantTarget } : null);
    setLastKingMove(lastKingMove ? { ...lastKingMove } : null);
    setMode('analysis');
    setAnalysisHistory([]);
    setAnalysisIndex(-1);
    setSelectedSquare(sel);
  };

  const deactivateAnalysis = () => {
    if (mode !== 'analysis') return;
    const saved = analysisSavedRef.current;
    if (saved) {
      setBoard(saved.board);
      setTurn(saved.turn);
      setKingState(deepClone(saved.kingState));
      setCastlingRights(deepClone(saved.castlingRights));
      setEnPassantTarget(saved.enPassantTarget || null);
      setLastKingMove(saved.lastKingMove || null);
    }
    setMode('play');
    setAnalysisHistory([]);
    setAnalysisIndex(-1);
    setSelectedSquare(null);
  };

  // Exit analysis without restoring the saved position. Used when
  // a remote move occurs while the user is in analysis mode so we
  // can return to play mode and keep the incoming board state.
  const forceExitAnalysis = () => {
    if (modeRef.current !== 'analysis') return;
    setMode('play');
    modeRef.current = 'play';
    setAnalysisHistory([]);
    setAnalysisIndex(-1);
    setSelectedSquare(null);
    analysisSavedRef.current = null;
  };
  
  useEffect(() => {
    const key = boardKey(
      initialBoard,
      'white',
      { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } },
      null
    );
    positionCountsRef.current = { [key]: 1 };
    // console.log('boardKey', key, 'count', 1);
  }, []);

  // useMoveHistory manages move history and undo/redo functionality

  // Keep current mode available for BroadcastChannel listeners
  useEffect(() => {
    modeRef.current = mode;
  });

  // Watch board/turn changes to show check/checkmate/draw messages
  useEffect(() => {
    if (mode === 'analysis') {
      setCheckmateInfo(null);
      setDrawInfo(null);
      setStatusMessage('');
      return;
    }
    const inCheck = isKingInCheck(board, turn);
    const hasMoves = hasAnyLegalMoves(board, turn, kingState, enPassantTarget, castlingRights);

    if (inCheck && !hasMoves) {
      setCheckmateInfo({ winner: turn === 'white' ? 'black' : 'white' });
      setStatusMessage('');
      return;
    }
    setCheckmateInfo(null);

    if (!inCheck && !hasMoves) {
      setDrawInfo({ type: 'stalemate', message: 'Draw by stalemate.' });
      return;
    }

    const pieces = board.flat().filter((p) => p !== '');
    const onlyKings = pieces.every((p) => p === '♔' || p === '♚');
    if (onlyKings) {
      setDrawInfo({ type: 'insufficient', message: 'Draw due to insufficient material.' });
    }

    setStatusMessage('');
  }, [board, turn]);

  // Main click handler for board squares. Handles selecting pieces, moving
  // them, triggering promotions and summoning UIs as well as castling logic.
  const handleClick = (row, col) => {
    const piece = board[row][col];

    if (mode === 'play' && turn !== playerColor && piece !== '' && ((turn === 'white' && isWhitePiece(piece)) || (turn === 'black' && isBlackPiece(piece)))) {
      activateAnalysis({ row, col });
      return;
    }

    // Close open promotion GUIs if open
    if (promotionOptions) {
      setPromotionOptions(null);
      return;
    }

    // Close open summon GUIs if open
    if (summonOptions) {
      // Summon was canceled by clicking the board
      const move = {
        from: lastKingMove
          ? { row: lastKingMove.fromRow, col: lastKingMove.fromCol }
          : { row: summonOptions.row, col: summonOptions.col },
        to: { row: summonOptions.row, col: summonOptions.col },
        piece: summonOptions.color === 'white' ? '♔' : '♚',
        board: cloneBoard(board),
        turn: turn,
        castlingRights: deepClone(castlingRights),
      };

      recordMove(move);
      setSummonOptions(null);
      setLastKingMove(null);
      setTurn(prev => (prev === 'white' ? 'black' : 'white'));
      setSelectedSquare(null);
      return; // Exit early to prevent selection re-trigger
    }

    // Clicked selectedSquare piece again? Deselect
    if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
      setSelectedSquare(null);
      return;
    }

    // Selecting a piece
    if (!selectedSquare) {
      if (piece !== '') {
        const pieceIsWhite = isWhitePiece(piece);
        if ((turn === 'white' && pieceIsWhite) || (turn === 'black' && !pieceIsWhite)) {
          setSelectedSquare({ row, col });
        }
      }
      return;
    }

    const selectedPiece = board[selectedSquare.row][selectedSquare.col];
    const targetPiece = board[row][col];

    // Prevent capturing own piece
    if (targetPiece && isSameTeam(selectedPiece, targetPiece)) {
      setSelectedSquare({ row, col });
      return;
    }

    let validMoves = [];


    // Movement logic

    if (selectedPiece === '♙' || selectedPiece === '♟') {
      validMoves = getValidPawnMoves(board, selectedSquare.row, selectedSquare.col, selectedPiece, enPassantTarget);
    }
    if (selectedPiece === '♖' || selectedPiece === '♜') {
      validMoves = getValidRookMoves(board, selectedSquare.row, selectedSquare.col, selectedPiece);
    }
    if (selectedPiece === '♕' || selectedPiece === '♛') {
      validMoves = getValidQueenMoves(board, selectedSquare.row, selectedSquare.col, selectedPiece);
    }
    if (selectedPiece === '♘' || selectedPiece === '♞') {
      validMoves = getValidKnightMoves(board, selectedSquare.row, selectedSquare.col, selectedPiece);
    }
    if (selectedPiece === '♗' || selectedPiece === '♝') {
      validMoves = getValidBishopMoves(board, selectedSquare.row, selectedSquare.col, selectedPiece);
    }
    if (selectedPiece === '♔' || selectedPiece === '♚') {
      const colorKey = selectedPiece === '♔' ? 'white' : 'black';
      validMoves = getValidKingMoves(
        board,
        selectedSquare.row,
        selectedSquare.col,
        selectedPiece,
        kingState[colorKey],
        castlingRights
      );
    }
    validMoves = filterLegalMoves(validMoves, board, selectedSquare.row, selectedSquare.col, selectedPiece, enPassantTarget);

    
    const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
    
    if (isValidMove) {
      if (reviewMode) {
        setStatusMessage('Return to the latest move to resume play.');
        setSelectedSquare(null);
        return;
      }
      const newBoard = cloneBoard(board);
      const movingPawn = selectedPiece;
    
      const movedPiece = board[selectedSquare.row][selectedSquare.col];
      const isPawn = movedPiece === '♙' || movedPiece === '♟';
      const targetRow = row;

      const isWhitePromotion = isPawn && movedPiece === '♙' && targetRow === 0;
      const isBlackPromotion = isPawn && movedPiece === '♟' && targetRow === 7;

      // Castling move
      if ((selectedPiece === '♔' || selectedPiece === '♚') && Math.abs(col - selectedSquare.col) === 2 && row === selectedSquare.row) {
        // Determine castling side and move the rook accordingly
        const isWhite = selectedPiece === '♔';
        const kingSide = col > selectedSquare.col;
        const rookFromCol = kingSide ? 7 : 0;
        const rookToCol = kingSide ? col - 1 : col + 1;

        newBoard[row][col] = selectedPiece;
        newBoard[selectedSquare.row][selectedSquare.col] = '';
        newBoard[row][rookFromCol] = '';
        newBoard[row][rookToCol] = isWhite ? '♖' : '♜';

        const updatedRights = {
          ...castlingRights,
          [isWhite ? 'white' : 'black']: { kingSide: false, queenSide: false },
        };
        setCastlingRights(updatedRights);
        setEnPassantTarget(null);
        setBoard(newBoard);

        const move = {
          from: { row: selectedSquare.row, col: selectedSquare.col },
          to: { row, col },
          piece: selectedPiece,
          castle: kingSide ? 'O-O' : 'O-O-O',
          board: cloneBoard(newBoard),
          turn: turn,
          kingState: deepClone(kingState),
          enPassantTarget: null,
          castlingRights: deepClone(updatedRights),
        };

        recordMove(move);
        setTurn(prev => (prev === 'white' ? 'black' : 'white'));
        setSelectedSquare(null);
        return;
      }

      // Ensure only current player's pieces can move
      const isWhiteTurn = turn === 'white';
      const isWhitePieceSelected = isWhitePiece(selectedPiece);
      if ((isWhiteTurn && !isWhitePieceSelected) || (!isWhiteTurn && isWhitePieceSelected)) {
        return;
      }


      if (selectedPiece === '♔' || selectedPiece === '♚') {
        setLastKingMove({
          fromRow: selectedSquare.row,
          fromCol: selectedSquare.col,
          toRow: row,
          toCol: col,
        });
      }      

      if (isWhitePromotion || isBlackPromotion) {
        setPromotionOptions({
          row,
          col,
          fromRow: selectedSquare.row,
          fromCol: selectedSquare.col,
          color: movedPiece === '♙' ? 'white' : 'black'
        });
        setEnPassantTarget(null);
        return;
      }

      // En passant capture
      if (
        (movingPawn === '♙' || movingPawn === '♟') &&
        enPassantTarget &&
        row === enPassantTarget.row &&
        col === enPassantTarget.col
      ) {
        const captureRow = selectedSquare.row;
        newBoard[captureRow][col] = ''; // Remove the passed pawn
      }
    
      // Set new en passant target
      const diff = Math.abs(row - selectedSquare.row);
      let newEnPassantTarget = null;
      if ((movingPawn === '♙' || movingPawn === '♟') && diff === 2) {
        newEnPassantTarget = { row: (row + selectedSquare.row) / 2, col };
      }
      setEnPassantTarget(newEnPassantTarget);

      newBoard[row][col] = selectedPiece;
      newBoard[selectedSquare.row][selectedSquare.col] = '';

      const updatedRights = { ...castlingRights };
      if (selectedPiece === '♔') {
        updatedRights.white.kingSide = false;
        updatedRights.white.queenSide = false;
      } else if (selectedPiece === '♚') {
        updatedRights.black.kingSide = false;
        updatedRights.black.queenSide = false;
      } else if (selectedPiece === '♖' && selectedSquare.row === 7 && selectedSquare.col === 0) {
        updatedRights.white.queenSide = false;
      } else if (selectedPiece === '♖' && selectedSquare.row === 7 && selectedSquare.col === 7) {
        updatedRights.white.kingSide = false;
      } else if (selectedPiece === '♜' && selectedSquare.row === 0 && selectedSquare.col === 0) {
        updatedRights.black.queenSide = false;
      } else if (selectedPiece === '♜' && selectedSquare.row === 0 && selectedSquare.col === 7) {
        updatedRights.black.kingSide = false;
      }
      if (targetPiece === '♖') {
        if (row === 7 && col === 0) updatedRights.white.queenSide = false;
        if (row === 7 && col === 7) updatedRights.white.kingSide = false;
      } else if (targetPiece === '♜') {
        if (row === 0 && col === 0) updatedRights.black.queenSide = false;
        if (row === 0 && col === 7) updatedRights.black.kingSide = false;
      }
      setCastlingRights(updatedRights);

      setBoard(newBoard);

      const isKing = selectedPiece === '♔' || selectedPiece === '♚';
      const pieceColor = selectedPiece === '♔' ? 'white' : 'black';
      const homeRow = isKing ? (pieceColor === 'white' ? 7 : 0) : null;
      const enemyRow = isKing ? (pieceColor === 'white' ? 0 : 7) : null;
      const reachedBackRank = isKing && row === enemyRow;
      const isBackHome = isKing && row === homeRow;

      let newKingState = kingState;
      if (isKing) {
        newKingState = {
          ...kingState,
          [pieceColor]: {
            ...kingState[pieceColor],
            returnedHome: isBackHome ? true : kingState[pieceColor].returnedHome,
            hasSummoned: isBackHome ? false : kingState[pieceColor].hasSummoned,
            needsReturn: isBackHome ? false : kingState[pieceColor].needsReturn,
          },
        };
      }

      const shouldWaitForSummon =
        isKing &&
        reachedBackRank &&
        !kingState[pieceColor].hasSummoned &&
        (!kingState[pieceColor].needsReturn || kingState[pieceColor].returnedHome);

      let moveKingState = newKingState;

      if (!shouldWaitForSummon) {
        const move = {
          from: { row: selectedSquare.row, col: selectedSquare.col },
          to: { row, col },
          piece: selectedPiece,
          captured: board[row][col] || null,
          board: cloneBoard(newBoard),
          turn: turn,
          kingState: deepClone(moveKingState),
          enPassantTarget: newEnPassantTarget,
          castlingRights: deepClone(updatedRights),
        };

        recordMove(move);
        setTurn(prev => (prev === 'white' ? 'black' : 'white'));
      }
      

      if (selectedPiece === '♔' || selectedPiece === '♚') {
        // const isWhite = selectedPiece === '♔';
        // const homeRow = isWhite ? 7 : 0;
        // const enemyRow = isWhite ? 0 : 7;
        // const pieceColor = isWhite ? 'white' : 'black';

        // const isBackHome = row === homeRow;

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

        setKingState(newKingState);
      }
   
    }

    setSelectedSquare(null);
  };
  // Used to reset the game after checkmate
  const resetGame = () => {
    setBoard(cloneBoard(initialBoard));
    setSelectedSquare(null);
    setEnPassantTarget(null);
    setKingState({
      white: { hasSummoned: false, needsReturn: false, returnedHome: false },
      black: { hasSummoned: false, needsReturn: false, returnedHome: false },
    });
    setSummonOptions(null);
    setPromotionOptions(null);
    setCastlingRights({
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    });
    setLastKingMove(null);
    setTurn('white');
    resetHistory();
    setStatusMessage('');
    setCheckmateInfo(null);
    setDrawInfo(null);
    setResignInfo(null);
    setHalfmoveClock(0);
    const key = boardKey(
      initialBoard,
      'white',
      { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } },
      null
    );
    positionCountsRef.current = { [key]: 1 };
    // console.log('boardKey', key, 'count', 1);
    if (!suppressRef.current) {
      sendCustom('reset');
    }
  };

  const { sendMove, sendUndo, sendJump: _sendJump, sendCustom } = useBroadcastChannel(
    'omega-chess',
    {
      onMove: (move) => {
        suppressRef.current = true;
        if (modeRef.current === 'analysis') {
          forceExitAnalysis();
        }
        setBoard(cloneBoard(move.board));
        setTurn(move.turn === 'white' ? 'black' : 'white');
        if (move.kingState) setKingState(deepClone(move.kingState));
        if (move.castlingRights) setCastlingRights(deepClone(move.castlingRights));
        setEnPassantTarget(move.enPassantTarget || null);
        if (recordMoveRef.current) recordMoveRef.current(move, true, move.skipCounts);
        setReviewMode(false);
        reviewModeRef.current = false;
        suppressRef.current = false;
      },
      onUndo: () => {
        suppressRef.current = true;
        if (modeRef.current === 'analysis') {
          forceExitAnalysis();
        }
        if (remoteUndoRef.current) remoteUndoRef.current();
        suppressRef.current = false;
      },
      onCustom: ({ type }) => {
        if (type === 'reset') {
          suppressRef.current = true;
          if (modeRef.current === 'analysis') {
            forceExitAnalysis();
          }
          resetGame();
          suppressRef.current = false;
        }
      },
    }
  );
  void _sendJump;

  const {
    moveHistory,
    historyIndex,
    analysisHistory,
    setAnalysisHistory,
    analysisIndex,
    setAnalysisIndex,
    recordMove,
    undoMove,
    redoMove,
    jumpToMove,
    remoteUndoRef,
    positionCountsRef,
    canRedo,
    resetHistory,
  } = useMoveHistory({
    initialBoard,
    playerColor,
    mode,
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
    recordMoveRef,
  });

  const {
    selectedSquare,
    setSelectedSquare,
    annotations,
    legalMoves,
    lastFromKey,
    lastToKey,
    checkSquares,
    boardRef,
    toDisplayCoords,
    fromDisplayCoords,
    overlayTop,
    squareSize,
    boardOffset,
    handleBoardMouseDown,
    handleBoardMouseUp,
  } = boardHighlights({
    board,
    playerColor,
    kingState,
    enPassantTarget,
    castlingRights,
    mode,
    moveHistory,
    historyIndex,
    analysisHistory,
    analysisIndex,
  });

  // Ref so we can auto-scroll the move list when new moves are added
  const moveListRef = useRef(null);
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [historyIndex, analysisIndex, mode]);

  return (
    <div style={{ position: 'relative' }}>
      {checkmateInfo && (
        <div className="overlay" onClick={() => setCheckmateInfo(null)}>
          <div className="checkmate-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '12px', fontSize: '24px' }}>
              Checkmate! {checkmateInfo.winner} wins.
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button onClick={resetGame}>Play Again</button>
              <button onClick={() => setCheckmateInfo(null)}>Review Game</button>
            </div>
          </div>
        </div>
      )}
      {drawInfo && (
        <div className="overlay" onClick={() => setDrawInfo(null)}>
          <div className="checkmate-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '12px', fontSize: '24px' }}>
              {drawInfo.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button onClick={resetGame}>Play Again</button>
              <button onClick={() => setDrawInfo(null)}>Review Game</button>
            </div>
          </div>
        </div>
      )}
      {resignInfo && (
        <div className="overlay" onClick={() => setResignInfo(null)}>
          <div className="checkmate-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '12px', fontSize: '24px' }}>
              Resignation! {resignInfo.winner} wins.
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button onClick={resetGame}>Play Again</button>
              <button onClick={() => setResignInfo(null)}>Review Game</button>
            </div>
          </div>
        </div>
      )}
      <div
        style={{ position: 'relative', width: '840px', height: '840px' }}
      >
      <svg
        width="840"
        height="840"
        className="annotation-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <marker
            id="ann-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="4"
            refY="2.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M3,1 L6,2.5 L3,4 Z" fill="orange" />
          </marker>
        </defs>
        {annotations.map((a, i) => {
  if (a.type === 'circle') return null;

  const df = toDisplayCoords(a.from.row, a.from.col);
  const dt = toDisplayCoords(a.to.row, a.to.col);
  const x1 = df.col * squareSize + squareSize / 2 + boardOffset;
  const y1 = df.row * squareSize + squareSize / 2 + boardOffset;
  const x2 = dt.col * squareSize + squareSize / 2 + boardOffset;
  const y2 = dt.row * squareSize + squareSize / 2 + boardOffset;

  let xEnd = x2;
  let yEnd = y2;
  let marker = undefined;

  if (a.type === 'arrow') {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const shorten = 25;
    xEnd = x2 - (dx / len) * shorten;
    yEnd = y2 - (dy / len) * shorten;
    marker = 'url(#ann-arrow)';
  }

  const stroke = a.type === 'arrow' ? 'orange' : 'red';

  return (
    <line
      key={i}
      x1={x1}
      y1={y1}
      x2={xEnd}
      y2={yEnd}
      stroke={stroke}
      strokeWidth={12}
      markerEnd={marker}
      opacity="0.65"
    />
  );
})}

      </svg>
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

        {selectedSquare && (() => {
          const piece = board[selectedSquare.row][selectedSquare.col];

          return legalMoves.map((move, i) => {
            if (!Array.isArray(move) || typeof move[0] !== 'number' || typeof move[1] !== 'number') return null;
          
            const [r, c] = move;
            const target = board[r]?.[c];
            const isEnemy = target && !isSameTeam(piece, target);
            const disp = toDisplayCoords(r, c);
            const endX = disp.col * 105 + 52.5 + 4;
            const endY = disp.row * 105 + 52.5 + 4;
            if (isEnemy) {
              return (
              //   Draws lines to each legal move a selected piece can make
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
                cx={endX}
                cy={endY}
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
                cx={endX}
                cy={endY}
                r={15}
                fill="black"
                opacity="0.2"
              />
            );
          });
        })()}
      </svg>

      <SummonOverlay
        board={board}
        summonOptions={summonOptions}
        kingState={kingState}
        setKingState={setKingState}
        lastKingMove={lastKingMove}
        setLastKingMove={setLastKingMove}
        castlingRights={castlingRights}
        enPassantTarget={enPassantTarget}
        turn={turn}
        recordMove={recordMove}
        setBoard={setBoard}
        setSummonOptions={setSummonOptions}
        setSelectedSquare={setSelectedSquare}
        setTurn={setTurn}
        overlayTop={overlayTop}
        toDisplayCoords={toDisplayCoords}
      />
      <PromotionOverlay
        board={board}
        promotionOptions={promotionOptions}
        castlingRights={castlingRights}
        enPassantTarget={enPassantTarget}
        turn={turn}
        recordMove={recordMove}
        setBoard={setBoard}
        setPromotionOptions={setPromotionOptions}
        setSelectedSquare={setSelectedSquare}
        setTurn={setTurn}
        overlayTop={overlayTop}
        toDisplayCoords={toDisplayCoords}
      />

      {statusMessage && (
        <div style={{ color: 'white', marginBottom: '8px', fontWeight: 'bold' }}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px' }}>
        {/* Left: Board container */}
        <div
          style={{ position: 'relative', width: '840px', height: '840px' }} ref={boardRef} onMouseDown={handleBoardMouseDown} onMouseUp={handleBoardMouseUp} onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (promotionOptions) {
              setPromotionOptions(null);
              setSelectedSquare(null);
            }
            if (summonOptions) {
              setSummonOptions(null);
              setSelectedSquare(null);
            }
          }}
        >
          {/* Board rendering below */}
          <div className={`board${mode === 'analysis' ? ' analysis' : ''}`} style={{ zIndex: 1, position: 'relative' }}>
          {Array.from({ length: 8 }).map((_, dispRow) => (
              <div key={dispRow} className="row">
                {Array.from({ length: 8 }).map((_, dispCol) => {
                  const { row: br, col: bc } = fromDisplayCoords(dispRow, dispCol);
                  const piece = board[br][bc];
                  const isDark = (br + bc) % 2 === 1;
                  const isSelected = selectedSquare?.row === br && selectedSquare?.col === bc;

                  const key = `${br}-${bc}`;
                  const isLastFrom = key === lastFromKey;
                  const isLastTo = key === lastToKey;
                  const isCheck = checkSquares.has(key);
                  const isCircleAnn = annotations.some(
                    (a) => a.type === 'circle' && a.row === br && a.col === bc
                  );

                  return (
                    <div
                      key={dispCol}
                      className={`square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleClick(br, bc)}
                    >
                      {(isLastFrom || isLastTo) && (
                        <div
                          className="highlight-overlay last-move-overlay"
                        ></div>
                      )}
                      {isCheck && (
                        <div
                          className="highlight-overlay check-overlay"
                        ></div>
                      )}
                      {isCircleAnn && (
                        <div
                          className="highlight-overlay check-overlay"
                        ></div>
                      )}
                      <div
                        className="label"
                        style={{
                          position: 'absolute',
                          top: '4px',
                          left: '7px',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: isDark ? '#f0d9b5' : '#b58863',
                        }}
                      >
                        {dispCol === 0
                          ? playerColor === 'white'
                            ? 8 - dispRow
                            : dispRow + 1
                          : ''}
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
                        }}
                      >
                        {dispRow === 7 ? String.fromCharCode(97 + bc) : ''}
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
        </div> {/* End of board container */}

        {/* Right: Sidebar */}
        <div style={{ width: '200px', color: 'white' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <button onClick={undoMove} disabled={(mode === 'analysis' ? analysisIndex : historyIndex) < 0}>Undo</button>
            <button onClick={redoMove} disabled={mode === 'analysis' ? analysisIndex >= analysisHistory.length - 1 : !canRedo}>Redo</button>
            <button onClick={() => setDrawInfo({ type: 'agreement', message: 'Draw by agreement.' })}>Draw</button>
            <button onClick={() => setResignInfo({ winner: turn === 'white' ? 'black' : 'white' })}>Resign</button>
            {mode === 'analysis' && (
              <button onClick={deactivateAnalysis}>Exit Analysis</button>
            )}
            {reviewMode && mode === 'play' && (
              <div style={{ color: 'yellow', fontWeight: 'bold' }}>Review Mode</div>
            )}
          </div>
          <div 
            ref={moveListRef}
            style={{
            width: '330px',
            color: 'white',
            maxHeight: '500px',
            overflowY: 'auto',
            paddingRight: '8px'
          }}>
            <ol style={{ paddingLeft: '20px', listStyle: 'none', margin: 0 }}>
              {Array.from({
                length: Math.ceil(
                  ((reviewMode ? moveHistory.length : historyIndex + 1) / 2)
                ),
              }).map((_, i) => {
                const whiteMove = moveHistory[i * 2];
                const blackMove = moveHistory[i * 2 + 1];

                const turnNum = i + 1;
                // const whiteText = whiteMove
                //   ? `W: ${whiteMove.piece} ${String.fromCharCode(97 + whiteMove.from.col)}${8 - whiteMove.from.row}→${String.fromCharCode(97 + whiteMove.to.col)}${8 - whiteMove.to.row}`
                //   : '';
                // const blackText = blackMove
                //   ? `B: ${blackMove.piece} ${String.fromCharCode(97 + blackMove.from.col)}${8 - blackMove.from.row}→${String.fromCharCode(97 + blackMove.to.col)}${8 - blackMove.to.row}`
                //   : '';

                let whiteText = '';
                if (whiteMove) {
                  

                  if (whiteMove.castle) {
                    whiteText = `W: ${whiteMove.castle}`;
                  } else {
                    const from = coordLabel(whiteMove.from.row, whiteMove.from.col);
                    const to = coordLabel(whiteMove.to.row, whiteMove.to.col);
                    whiteText = `W: ${whiteMove.piece} ${from}→${to}`;
                  }

                  if (whiteMove.promotion) {
                    whiteText += `=${whiteMove.promotion}`;
                  }

                  if (whiteMove.summon) {
                    const summonTo = coordLabel(
                      whiteMove.summon.to.row,
                      whiteMove.summon.to.col
                    );
                    whiteText += `+${whiteMove.summon.piece}${summonTo}`;
                  }
                }
                let blackText = '';
                if (blackMove) {
                  

                  if (blackMove.castle) {
                    blackText = `B: ${blackMove.castle}`;
                  } else {
                    const from = coordLabel(blackMove.from.row, blackMove.from.col);
                    const to = coordLabel(blackMove.to.row, blackMove.to.col);
                    blackText = `B: ${blackMove.piece} ${from}→${to}`;
                  }

                  if (blackMove.promotion) {
                    blackText += `=${blackMove.promotion}`;
                  }

                  if (blackMove.summon) {
                    const summonTo = coordLabel(
                      blackMove.summon.to.row,
                      blackMove.summon.to.col
                    );
                    blackText += `+${blackMove.summon.piece}${summonTo}`;
                  }
                }

                const isWhiteBold = historyIndex === i * 2;
                const isBlackBold = historyIndex === i * 2 + 1;

                return (
                  <li key={i} style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span
                      onClick={() => jumpToMove(whiteMove?.id)}
                      style={{
                        fontWeight: isWhiteBold ? 'bold' : 'normal',
                        minWidth: '140px',
                        cursor: 'pointer'
                      }}
                    >
                      {turnNum}. {whiteText}
                    </span>
                    <span
                      onClick={() => jumpToMove(blackMove?.id)}
                      style={{
                        marginLeft: '16px',
                        fontWeight: isBlackBold ? 'bold' : 'normal',
                        minWidth: '120px',
                        cursor: 'pointer'
                      }}
                    >
                      {blackText}
                    </span>
                  </li>

                );
              })}
              {mode === 'analysis' && (() => {
                const groups = [];
                for (let i = 0; i < analysisHistory.length; i += 2) {
                  groups.push({ first: analysisHistory[i], second: analysisHistory[i + 1], index: i });
                }

                const renderMoveText = (m) => {
                  if (!m) return '';
                  let t = '';
                  if (m.castle) {
                    t = m.castle;
                  } else {
                    const from = coordLabel(m.from.row, m.from.col);
                    const to = coordLabel(m.to.row, m.to.col);
                    t = `${m.piece} ${from}→${to}`;
                  }
                  if (m.promotion) t += `=${m.promotion}`;
                  if (m.summon) {
                    const summonTo = coordLabel(m.summon.to.row, m.summon.to.col);
                    t += `+${m.summon.piece}${summonTo}`;
                  }
                  return t;
                };

                return groups.map((g, i) => {
                  const firstText = renderMoveText(g.first);
                  const secondText = renderMoveText(g.second);
                  const firstLabel = g.first ? (g.first.turn === 'white' ? 'W:' : 'B:') : '';
                  const secondLabel = g.second ? (g.second.turn === 'white' ? 'W:' : 'B:') : '';
                  const isFirstBold = analysisIndex === g.index;
                  const isSecondBold = analysisIndex === g.index + 1;

                  return (
                    <li key={`a${i}`} style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span
                        onClick={() => jumpToMove(g.first?.id ?? g.index)}
                        style={{
                          fontWeight: isFirstBold ? 'bold' : 'normal',
                          minWidth: '140px',
                          cursor: 'pointer'
                        }}
                      >
                        🧪 {firstLabel} {firstText}
                      </span>
                      <span
                        onClick={() => jumpToMove(g.second?.id ?? g.index + 1)}
                        style={{
                          marginLeft: '16px',
                          fontWeight: isSecondBold ? 'bold' : 'normal',
                          minWidth: '120px',
                          cursor: 'pointer'
                        }}
                      >
                        {secondLabel} {secondText}
                      </span>
                    </li>
                  );
                });
              })()}
              
            </ol>

          </div>
        </div>
      </div>
    </div>
    <img
      src="src/assets/logo.png"
      alt="Ωhess Logo"
      className="omega-logo"
    />
  </div>
    
  );
}

export default App;
// 1480 -> 1430 -> 2300