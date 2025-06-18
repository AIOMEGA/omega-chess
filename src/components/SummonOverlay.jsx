/* eslint react/prop-types: off */
import { cloneBoard, deepClone, isSameTeam } from '../utils/helpers.js';
import { performSummon } from '../logic/moveRules.js';

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
  },
};

export default function SummonOverlay({
  board,
  summonOptions,
  kingState,
  setKingState,
  lastKingMove,
  setLastKingMove,
  castlingRights,
  enPassantTarget,
  turn,
  recordMove,
  setBoard,
  setSummonOptions,
  setSelectedSquare,
  setTurn,
  overlayTop,
  toDisplayCoords,
}) {
  if (!summonOptions) return null;

  const summonSymbols =
    summonOptions.color === 'white'
      ? ['♕', '♘', '♖', '♗']
      : ['♛', '♞', '♜', '♝'];

  return (
    <div className="summon-ui" onClick={(e) => e.stopPropagation()}>
      {[summonOptions.col - 1, summonOptions.col + 1]
        .filter((c) => {
          const neighborPiece = board[summonOptions.row]?.[c];
          if (!neighborPiece) return true;
          return !isSameTeam(
            neighborPiece,
            summonOptions.color === 'white' ? '♙' : '♟',
          );
        })
        .filter((c) => c >= 0 && c < 8)
        .map((c) => (
          <div
            key={c}
            className="summon-column"
            style={{
              left: `${toDisplayCoords(summonOptions.row, c).col * 105 + 4}px`,
              top: `${overlayTop(summonOptions.row)}px`,
            }}
          >
            {summonSymbols.map((symbol, i) => (
              <img
                key={i}
                src={`/src/assets/pieces/${pieceImagesMap[summonOptions.color][symbol]}`}
                alt={symbol}
                style={{ width: '80px', height: '80px', margin: '5px', cursor: 'pointer' }}
                onClick={() => {
                  const newBoard = performSummon(
                    board,
                    summonOptions.row,
                    c,
                    summonOptions.color,
                    symbol,
                  );

                  const newKingState = {
                    ...kingState,
                    [summonOptions.color]: {
                      hasSummoned: true,
                      needsReturn: true,
                      returnedHome: false,
                    },
                  };
                  setKingState(newKingState);

                  const move = {
                    from: lastKingMove
                      ? { row: lastKingMove.fromRow, col: lastKingMove.fromCol }
                      : { row: summonOptions.row, col: summonOptions.col },
                    to: { row: summonOptions.row, col: summonOptions.col },
                    piece: summonOptions.color === 'white' ? '♔' : '♚',
                    summon: { piece: symbol, to: { row: summonOptions.row, col: c } },
                    board: cloneBoard(newBoard),
                    turn: turn,
                    kingState: deepClone(newKingState),
                    enPassantTarget,
                    castlingRights: deepClone(castlingRights),
                  };

                  recordMove(move);
                  setBoard(newBoard);
                  setTurn((prev) => (prev === 'white' ? 'black' : 'white'));
                  setSummonOptions(null);
                  setLastKingMove(null);
                  setSelectedSquare(null);
                }}
              />
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();

                const move = {
                  from: lastKingMove
                    ? { row: lastKingMove.fromRow, col: lastKingMove.fromCol }
                    : { row: summonOptions.row, col: summonOptions.col },
                  to: { row: summonOptions.row, col: summonOptions.col },
                  piece: summonOptions.color === 'white' ? '♔' : '♚',
                  board: cloneBoard(board),
                  turn: turn,
                  kingState: deepClone(kingState),
                  enPassantTarget,
                  castlingRights: deepClone(castlingRights),
                };

                recordMove(move);
                setSummonOptions(null);
                setLastKingMove(null);
                setTurn((prev) => (prev === 'white' ? 'black' : 'white'));
                setSelectedSquare(null);
              }}
            >
              X
            </button>
          </div>
        ))}
    </div>
  );
}