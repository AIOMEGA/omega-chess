/* eslint react/prop-types: off */
import { cloneBoard, deepClone } from '../utils/helpers.js';
import { performPromotion } from '../logic/moveRules.js';

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

export default function PromotionOverlay({
  board,
  promotionOptions,
  castlingRights,
  enPassantTarget,
  turn,
  recordMove,
  setBoard,
  setPromotionOptions,
  setSelectedSquare,
  setTurn,
  overlayTop,
  toDisplayCoords,
}) {
  if (!promotionOptions) return null;

  const choices =
    promotionOptions.color === 'white'
      ? ['♕', '♘', '♖', '♗']
      : ['♛', '♞', '♜', '♝'];

  return (
    <div className="summon-ui" onClick={(e) => e.stopPropagation()}>
      {[promotionOptions.col].map((c) => (
        <div
          key={c}
          className="summon-column"
          style={{
            left: `${toDisplayCoords(promotionOptions.row, c).col * 105 + 4}px`,
            top: `${overlayTop(promotionOptions.row)}px`,
          }}
        >
          {choices.map((symbol, i) => (
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
                  symbol,
                );

                const move = {
                  from: { row: promotionOptions.fromRow, col: promotionOptions.fromCol },
                  to: { row: promotionOptions.row, col: promotionOptions.col },
                  piece: promotionOptions.color === 'white' ? '♙' : '♟',
                  promotion: symbol,
                  board: cloneBoard(newBoard),
                  turn: turn,
                  enPassantTarget,
                  castlingRights: deepClone(castlingRights),
                };

                recordMove(move);
                setBoard(newBoard);
                setPromotionOptions(null);
                setSelectedSquare(null);
                setTurn((prev) => (prev === 'white' ? 'black' : 'white'));
              }}
            />
          ))}
          <button
            onClick={() => {
              setPromotionOptions(null);
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