// Unicode pieces (♙♘♗♖♕♔ / ♟♞♝♜♛♚)
// Starting layout for a new game
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
  
// Map each Unicode piece to its SVG image file. Assets sourced from https://github.com/lichess-org/lila/tree/master/public/piece
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

// Lists of piece symbols to quickly determine piece color
const WHITE_PIECES = ['♙', '♘', '♗', '♖', '♕', '♔'];
const BLACK_PIECES = ['♟', '♞', '♝', '♜', '♛', '♚'];

export {
    initialBoard,
    pieceImages,
    WHITE_PIECES,
    BLACK_PIECES,
};