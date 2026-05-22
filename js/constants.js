/**
 * constants.js — Chess Constants & Enumerations
 * 
 * Defines all symbolic constants used throughout the chess engine and UI.
 * Uses a frozen namespace to prevent accidental mutation.
 */

'use strict';

var Chess = window.Chess || {};

// ── Piece Colors ──────────────────────────────────────────────────────
Chess.WHITE = 0;
Chess.BLACK = 1;

// ── Piece Types ───────────────────────────────────────────────────────
Chess.PAWN   = 1;
Chess.KNIGHT = 2;
Chess.BISHOP = 3;
Chess.ROOK   = 4;
Chess.QUEEN  = 5;
Chess.KING   = 6;

// ── Game States ───────────────────────────────────────────────────────
Chess.PLAYING   = 'playing';
Chess.CHECK     = 'check';
Chess.CHECKMATE = 'checkmate';
Chess.STALEMATE = 'stalemate';
Chess.DRAW_INSUFFICIENT = 'draw_insufficient';
Chess.DRAW_FIFTY_MOVE   = 'draw_fifty_move';
Chess.DRAW_THREEFOLD    = 'draw_threefold';
Chess.DRAW_AGREEMENT    = 'draw_agreement';
Chess.RESIGNED          = 'resigned';

// ── Starting Position (FEN) ───────────────────────────────────────────
Chess.STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ── Direction Vectors ─────────────────────────────────────────────────
// [rankDelta, fileDelta] for sliding and stepping pieces
Chess.DIRECTIONS = Object.freeze({
    ORTHOGONAL: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    DIAGONAL:   [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    KNIGHT:     [[2, 1], [2, -1], [-2, 1], [-2, -1],
                 [1, 2], [1, -2], [-1, 2], [-1, -2]],
    KING:       [[1, 0], [-1, 0], [0, 1], [0, -1],
                 [1, 1], [1, -1], [-1, 1], [-1, -1]]
});

// ── Piece Names for Display ───────────────────────────────────────────
Chess.PIECE_NAMES = Object.freeze({
    [Chess.PAWN]:   'Pawn',
    [Chess.KNIGHT]: 'Knight',
    [Chess.BISHOP]: 'Bishop',
    [Chess.ROOK]:   'Rook',
    [Chess.QUEEN]:  'Queen',
    [Chess.KING]:   'King'
});

// ── Algebraic Notation Letters ────────────────────────────────────────
Chess.PIECE_LETTERS = Object.freeze({
    [Chess.PAWN]:   '',
    [Chess.KNIGHT]: 'N',
    [Chess.BISHOP]: 'B',
    [Chess.ROOK]:   'R',
    [Chess.QUEEN]:  'Q',
    [Chess.KING]:   'K'
});

// ── FEN Piece Characters ─────────────────────────────────────────────
Chess.FEN_PIECES = Object.freeze({
    'P': { type: Chess.PAWN,   color: Chess.WHITE },
    'N': { type: Chess.KNIGHT, color: Chess.WHITE },
    'B': { type: Chess.BISHOP, color: Chess.WHITE },
    'R': { type: Chess.ROOK,   color: Chess.WHITE },
    'Q': { type: Chess.QUEEN,  color: Chess.WHITE },
    'K': { type: Chess.KING,   color: Chess.WHITE },
    'p': { type: Chess.PAWN,   color: Chess.BLACK },
    'n': { type: Chess.KNIGHT, color: Chess.BLACK },
    'b': { type: Chess.BISHOP, color: Chess.BLACK },
    'r': { type: Chess.ROOK,   color: Chess.BLACK },
    'q': { type: Chess.QUEEN,  color: Chess.BLACK },
    'k': { type: Chess.KING,   color: Chess.BLACK }
});

// ── File and Rank Labels ──────────────────────────────────────────────
Chess.FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
Chess.RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

// ── Utility: Convert between algebraic and array indices ──────────────

/**
 * Convert algebraic square name (e.g. "e4") to [rank, file] indices.
 * rank 0 = rank 1, rank 7 = rank 8
 * file 0 = file a, file 7 = file h
 */
Chess.algebraicToIndex = function(sq) {
    if (!sq || sq.length !== 2) return null;
    const file = sq.charCodeAt(0) - 97; // 'a' = 0
    const rank = parseInt(sq[1], 10) - 1; // '1' = 0
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
    return [rank, file];
};

/**
 * Convert [rank, file] indices to algebraic square name.
 */
Chess.indexToAlgebraic = function(rank, file) {
    return Chess.FILES[file] + Chess.RANKS[rank];
};

/**
 * Check if rank and file are within the board bounds.
 */
Chess.isOnBoard = function(rank, file) {
    return rank >= 0 && rank <= 7 && file >= 0 && file <= 7;
};

/**
 * Get the opponent's color.
 */
Chess.oppositeColor = function(color) {
    return color === Chess.WHITE ? Chess.BLACK : Chess.WHITE;
};

window.Chess = Chess;
