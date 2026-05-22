/**
 * pieces.js — Chess Vector Pieces
 * 
 * Provides crisp, premium, responsive SVG icons for all 12 chess pieces.
 * Based on the classic, modern cburnett vector set.
 */

'use strict';

var Chess = window.Chess || {};

Chess.PIECE_SVGS = {
    // ── WHITE PAWN ──────────────────────────────────────────────────
    'wP': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-.83.62-1.41 1.61-1.41 2.72 0 1.93 1.57 3.5 3.5 3.5h4c1.93 0 3.5-1.57 3.5-3.5 0-1.11-.58-2.1-1.41-2.72C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
                  fill="#ffffff" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
    `,
    // ── BLACK PAWN ──────────────────────────────────────────────────
    'bP': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-.83.62-1.41 1.61-1.41 2.72 0 1.93 1.57 3.5 3.5 3.5h4c1.93 0 3.5-1.57 3.5-3.5 0-1.11-.58-2.1-1.41-2.72C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
                  fill="#454545" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
    `,
    // ── WHITE KNIGHT ────────────────────────────────────────────────
    'wN': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M 22,10 C 22,10 19,11 16,15 C 13,19 13,23 13,23 C 13,23 14.5,21 16.5,21.5 C 18.5,22 17,24 16,25 C 15,26 14,28.5 15,31 C 16,33.5 19,34 19,34 C 19,34 21,32 22,30 C 22,30 22,33 27,33 C 32,33 34,31 34,26 C 34,21 32,17 29,14 C 26,11 22,10 22,10 z"
                  fill="#ffffff" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
                  transform="matrix(0.861785,0.507278,-0.507278,0.861785,27.1344,-2.25146)"
                  fill="#000000"/>
            <path d="M20 23.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="#ffffff" stroke="#000000" stroke-width="0.5"/>
        </svg>
    `,
    // ── BLACK KNIGHT ────────────────────────────────────────────────
    'bN': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M 22,10 C 22,10 19,11 16,15 C 13,19 13,23 13,23 C 13,23 14.5,21 16.5,21.5 C 18.5,22 17,24 16,25 C 15,26 14,28.5 15,31 C 16,33.5 19,34 19,34 C 19,34 21,32 22,30 C 22,30 22,33 27,33 C 32,33 34,31 34,26 C 34,21 32,17 29,14 C 26,11 22,10 22,10 z"
                  fill="#454545" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
                  transform="matrix(0.861785,0.507278,-0.507278,0.861785,27.1344,-2.25146)"
                  fill="#ffffff"/>
            <path d="M20 23.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="#000000" stroke="#ffffff" stroke-width="0.5"/>
        </svg>
    `,
    // ── WHITE BISHOP ────────────────────────────────────────────────
    'wB': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M9 36c3.39 0 7.66-.69 11.77-2.3 4.06 1.61 8.33 2.3 11.77 2.3 1.67 0 2.52-.78 2.52-2.3 0-6.24-5.32-8.31-7.14-15.02C29.62 12.3 27.56 9 22.5 9s-7.12 3.3-5.28 9.68c-1.82 6.71-7.14 8.78-7.14 15.02 0 1.52.85 2.3 2.52 2.3z"
                  fill="#ffffff" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="22.5" cy="5.5" r="2" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>
            <path d="M22.5 13v15M17.5 18h10" fill="none" stroke="#000000" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
    `,
    // ── BLACK BISHOP ────────────────────────────────────────────────
    'bB': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M9 36c3.39 0 7.66-.69 11.77-2.3 4.06 1.61 8.33 2.3 11.77 2.3 1.67 0 2.52-.78 2.52-2.3 0-6.24-5.32-8.31-7.14-15.02C29.62 12.3 27.56 9 22.5 9s-7.12 3.3-5.28 9.68c-1.82 6.71-7.14 8.78-7.14 15.02 0 1.52.85 2.3 2.52 2.3z"
                  fill="#454545" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="22.5" cy="5.5" r="2" fill="#454545" stroke="#000000" stroke-width="1.5"/>
            <path d="M22.5 13v15M17.5 18h10" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
    `,
    // ── WHITE ROOK ──────────────────────────────────────────────────
    'wR': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M9 39h27v-3H9v3zm3-13h21v-4H12v4zm2.5-4l1.5-12h18l1.5 12h-21z"
                  fill="#ffffff" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 12V9h4v3h5V9h4v3h5V9h4v3h3v3H9v-3h3z"
                  fill="#ffffff" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `,
    // ── BLACK ROOK ──────────────────────────────────────────────────
    'bR': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M9 39h27v-3H9v3zm3-13h21v-4H12v4zm2.5-4l1.5-12h18l1.5 12h-21z"
                  fill="#454545" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 12V9h4v3h5V9h4v3h5V9h4v3h3v3H9v-3h3z"
                  fill="#454545" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `,
    // ── WHITE QUEEN ─────────────────────────────────────────────────
    'wQ': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm14.5-4a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm14.5 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>
            <path d="M9 37h27v-3H9v3zm3.5-3l2-20h21l2 20h-25z" fill="#ffffff" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 16l6 18h21l6-18L30 26 22.5 14 15 26 6 16z" fill="#ffffff" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `,
    // ── BLACK QUEEN ─────────────────────────────────────────────────
    'bQ': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm14.5-4a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm14.5 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill="#454545" stroke="#000000" stroke-width="1.5"/>
            <path d="M9 37h27v-3H9v3zm3.5-3l2-20h21l2 20h-25z" fill="#454545" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 16l6 18h21l6-18L30 26 22.5 14 15 26 6 16z" fill="#454545" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `,
    // ── WHITE KING ──────────────────────────────────────────────────
    'wK': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M22.5 11.63V6M20 8h5M12 36c4 0 7-1 10.5-2.5C26 35 29 36 33 36c1.5 0 2.5-.5 2.5-2 0-4-3-6-6-10-3-4-3-8-3-8h-8s0 4-3 8c-3 4-6 6-6 10 0 1.5 1 2 2.5 2z"
                  fill="#ffffff" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11.5 30c5.5-1 16.5-1 22 0M11.5 33c5.5-.5 16.5-.5 22 0" fill="none" stroke="#000000" stroke-width="1.5"/>
        </svg>
    `,
    // ── BLACK KING ──────────────────────────────────────────────────
    'bK': `
        <svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" class="chess-piece-svg">
            <path d="M22.5 11.63V6M20 8h5M12 36c4 0 7-1 10.5-2.5C26 35 29 36 33 36c1.5 0 2.5-.5 2.5-2 0-4-3-6-6-10-3-4-3-8-3-8h-8s0 4-3 8c-3 4-6 6-6 10 0 1.5 1 2 2.5 2z"
                  fill="#454545" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11.5 30c5.5-1 16.5-1 22 0M11.5 33c5.5-.5 16.5-.5 22 0" fill="none" stroke="#ffffff" stroke-width="1.5"/>
        </svg>
    `
};

/**
 * Returns the HTML string of the SVG for a given piece code (e.g. 'wP', 'bN').
 */
Chess.getPieceSvgHtml = function(type, color) {
    const code = (color === Chess.WHITE ? 'w' : 'b') + 
                 (type === Chess.PAWN ? 'P' :
                  type === Chess.KNIGHT ? 'N' :
                  type === Chess.BISHOP ? 'B' :
                  type === Chess.ROOK ? 'R' :
                  type === Chess.QUEEN ? 'Q' : 'K');
    return Chess.PIECE_SVGS[code] || '';
};

window.Chess = Chess;
