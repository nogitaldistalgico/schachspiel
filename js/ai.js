/**
 * ai.js — Chess AI Opponent
 * 
 * Implements a Minimax search engine with Alpha-Beta pruning, move ordering,
 * and positional evaluation tables (Piece-Square Tables).
 * Provides a scalable difficulty level (Depth 1 to 4).
 */

'use strict';

var Chess = window.Chess || {};

class ChessAI {
    constructor() {
        // Material values
        this.VALUES = {
            [Chess.PAWN]: 100,
            [Chess.KNIGHT]: 320,
            [Chess.BISHOP]: 330,
            [Chess.ROOK]: 500,
            [Chess.QUEEN]: 900,
            [Chess.KING]: 20000
        };

        // Positional Evaluation Tables (Piece-Square Tables)
        // Values from White's perspective (index 0 is rank 1, index 7 is rank 8).
        // For Black, the rank index is flipped (7 - rank).
        this.PST = {
            [Chess.PAWN]: [
                [ 0,  0,  0,  0,  0,  0,  0,  0],
                [ 5, 10, 10,-20,-20, 10, 10,  5],
                [ 5, -5,-10,  0,  0,-10, -5,  5],
                [ 0,  0,  0, 20, 20,  0,  0,  0],
                [ 5,  5, 10, 25, 25, 10,  5,  5],
                [10, 10, 20, 30, 30, 20, 10, 10],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [ 0,  0,  0,  0,  0,  0,  0,  0]
            ],
            [Chess.KNIGHT]: [
                [-50,-40,-30,-30,-30,-30,-40,-50],
                [-40,-20,  0,  5,  5,  0,-20,-40],
                [-30,  5, 10, 15, 15, 10,  5,-30],
                [-30,  0, 15, 20, 20, 15,  0,-30],
                [-30,  5, 15, 20, 20, 15,  5,-30],
                [-30,  0, 10, 15, 15, 10,  0,-30],
                [-40,-20,  0,  0,  0,  0,-20,-40],
                [-50,-40,-30,-30,-30,-30,-40,-50]
            ],
            [Chess.BISHOP]: [
                [-20,-10,-10,-10,-10,-10,-10,-20],
                [-10,  5,  0,  0,  0,  0,  5,-10],
                [-10, 10, 10, 10, 10, 10, 10,-10],
                [-10,  0, 10, 10, 10, 10,  0,-10],
                [-10,  5,  5, 10, 10,  5,  5,-10],
                [-10,  0,  0, 10, 10,  0,  0,-10],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-20,-10,-10,-10,-10,-10,-10,-20]
            ],
            [Chess.ROOK]: [
                [  0,  0,  0,  5,  5,  0,  0,  0],
                [ -5,  0,  0,  0,  0,  0,  0, -5],
                [ -5,  0,  0,  0,  0,  0,  0, -5],
                [ -5,  0,  0,  0,  0,  0,  0, -5],
                [ -5,  0,  0,  0,  0,  0,  0, -5],
                [ -5,  0,  0,  0,  0,  0,  0, -5],
                [  5, 10, 10, 10, 10, 10, 10,  5],
                [  0,  0,  0,  0,  0,  0,  0,  0]
            ],
            [Chess.QUEEN]: [
                [-20,-10,-10, -5, -5,-10,-10,-20],
                [-10,  0,  5,  0,  0,  0,  0,-10],
                [-10,  5,  5,  5,  5,  5,  0,-10],
                [  0,  0,  5,  5,  5,  5,  0, -5],
                [ -5,  0,  5,  5,  5,  5,  0, -5],
                [-10,  0,  5,  5,  5,  5,  0,-10],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-20,-10,-10, -5, -5,-10,-10,-20]
            ],
            [Chess.KING]: {
                // Middlegame (safety first)
                middle: [
                    [ 20, 30, 10,  0,  0, 10, 30, 20],
                    [ 20, 20,  0,  0,  0,  0, 20, 20],
                    [-10,-20,-20,-20,-20,-20,-20,-10],
                    [-20,-30,-30,-40,-40,-30,-30,-20],
                    [-30,-40,-40,-50,-50,-40,-40,-30],
                    [-30,-40,-40,-50,-50,-40,-40,-30],
                    [-30,-40,-40,-50,-50,-40,-40,-30],
                    [-30,-40,-40,-50,-50,-40,-40,-30]
                ],
                // Endgame (active king)
                end: [
                    [-50,-30,-30,-30,-30,-30,-30,-50],
                    [-30,-30,  0,  0,  0,  0,-30,-30],
                    [-30, -10, 20, 30, 30, 20,-10,-30],
                    [-30, -10, 30, 40, 40, 30,-10,-30],
                    [-30, -10, 30, 40, 40, 30,-10,-30],
                    [-30, -10, 20, 30, 30, 20,-10,-30],
                    [-30,-20,-10,  0,  0,-10,-20,-30],
                    [-50,-40,-30,-30,-30,-30,-40,-50]
                ]
            }
        };
    }

    /**
     * Helper to check if a position is in the endgame stage.
     * Endgame is defined as both sides having no queens, or each side having <= 1 major/minor piece.
     */
    isEndgame(engine) {
        let whitePiecesCount = 0;
        let blackPiecesCount = 0;
        let whiteQueens = 0;
        let blackQueens = 0;

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const piece = engine.board[r][f];
                if (piece) {
                    if (piece.type !== Chess.KING && piece.type !== Chess.PAWN) {
                        if (piece.color === Chess.WHITE) {
                            whitePiecesCount++;
                            if (piece.type === Chess.QUEEN) whiteQueens++;
                        } else {
                            blackPiecesCount++;
                            if (piece.type === Chess.QUEEN) blackQueens++;
                        }
                    }
                }
            }
        }

        if (whiteQueens === 0 && blackQueens === 0) return true;
        if (whiteQueens === 1 && whitePiecesCount <= 2 && blackQueens === 1 && blackPiecesCount <= 2) return true;
        return false;
    }

    /**
     * Evaluates the board from the perspective of white.
     * Positive score favors White, negative favors Black.
     */
    evaluateBoard(engine) {
        let score = 0;
        const endgame = this.isEndgame(engine);

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const piece = engine.board[r][f];
                if (!piece) continue;

                const isWhite = (piece.color === Chess.WHITE);
                const type = piece.type;

                // 1. Material Value
                let val = this.VALUES[type];

                // 2. Positional Value
                let posVal = 0;
                if (type === Chess.KING) {
                    const kingTable = endgame ? this.PST[Chess.KING].end : this.PST[Chess.KING].middle;
                    posVal = isWhite ? kingTable[r][f] : kingTable[7 - r][f];
                } else {
                    const table = this.PST[type];
                    posVal = isWhite ? table[r][f] : table[7 - r][f];
                }

                const totalVal = val + posVal;
                score += isWhite ? totalVal : -totalVal;
            }
        }

        return score;
    }

    /**
     * Orders moves to maximize Alpha-Beta efficiency.
     * Prioritizes captures (using MVV-LVA: Most Valuable Victim - Least Valuable Aggressor),
     * promotions, and checks.
     */
    orderMoves(engine, moves) {
        return moves.map(move => {
            let score = 0;

            // 1. Captures (MVV-LVA)
            if (move.captured) {
                // Higher values for capturing more valuable pieces with less valuable pieces
                score = 10000 + (this.VALUES[move.captured.type] * 10) - this.VALUES[move.piece.type];
            }

            // 2. Promotion
            if (move.flags === 'p') {
                score += 8000 + this.VALUES[move.promotion];
            }

            // 3. Move castling up slightly
            if (move.flags === 'c') {
                score += 1000;
            }

            // 4. Giving check
            engine.makeMoveSilent(move);
            if (engine.isInCheck(engine.activeColor)) {
                score += 5000;
            }
            engine.undoMoveSilent();

            return { move, score };
        })
        .sort((a, b) => b.score - a.score)
        .map(x => x.move);
    }

    /**
     * Minimax with Alpha-Beta pruning.
     */
    minimax(engine, depth, alpha, beta, isMaximizing, nodesCount) {
        nodesCount.val++;

        // Base cases
        const state = engine.getGameState();
        if (state === Chess.CHECKMATE) {
            // If maximizing player (White) is checkmated, return negative infinity.
            // If minimizing player (Black) is checkmated, return positive infinity.
            // Adjust score by depth to favor faster checkmates
            return isMaximizing ? -300000 + (4 - depth) : 300000 - (4 - depth);
        }
        if (state === Chess.STALEMATE || 
            state === Chess.DRAW_INSUFFICIENT || 
            state === Chess.DRAW_FIFTY_MOVE || 
            state === Chess.DRAW_THREEFOLD) {
            return 0; // Draw score
        }

        if (depth === 0) {
            return this.evaluateBoard(engine);
        }

        const rawMoves = engine.generateLegalMoves();
        if (rawMoves.length === 0) {
            return this.evaluateBoard(engine); // Fallback
        }

        const moves = this.orderMoves(engine, rawMoves);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                engine.makeMoveSilent(move);
                const evaluation = this.minimax(engine, depth - 1, alpha, beta, false, nodesCount);
                engine.undoMoveSilent();
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) {
                    break; // Prune
                }
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                engine.makeMoveSilent(move);
                const evaluation = this.minimax(engine, depth - 1, alpha, beta, true, nodesCount);
                engine.undoMoveSilent();
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) {
                    break; // Prune
                }
            }
            return minEval;
        }
    }

    /**
     * Finds the best move for the active color at the specified depth.
     * Uses asynchronous/setTimeout style return so UI thread remains responsive.
     */
    getBestMoveAsync(engine, difficulty = 'medium') {
        return new Promise((resolve) => {
            // Set search depth based on difficulty
            let depth = 3;
            if (difficulty === 'easy') depth = 1;
            if (difficulty === 'medium') depth = 2;
            if (difficulty === 'hard') depth = 3;
            if (difficulty === 'expert') depth = 4; // Warning: Expert can take a few seconds on complex positions

            setTimeout(() => {
                const startTime = performance.now();
                const rawMoves = engine.generateLegalMoves();
                if (rawMoves.length === 0) {
                    resolve(null);
                    return;
                }

                // If only one legal move, play it instantly
                if (rawMoves.length === 1) {
                    resolve(rawMoves[0]);
                    return;
                }

                // Simple randomized opening move for variety if starting position
                if (engine.history.length === 1 && depth > 1) {
                    const e4 = rawMoves.find(m => Chess.indexToAlgebraic(m.from[0], m.from[1]) === 'e2' && Chess.indexToAlgebraic(m.to[0], m.to[1]) === 'e4');
                    const d4 = rawMoves.find(m => Chess.indexToAlgebraic(m.from[0], m.from[1]) === 'd2' && Chess.indexToAlgebraic(m.to[0], m.to[1]) === 'd4');
                    const nf3 = rawMoves.find(m => Chess.indexToAlgebraic(m.from[0], m.from[1]) === 'g1' && Chess.indexToAlgebraic(m.to[0], m.to[1]) === 'f3');
                    const openings = [e4, d4, nf3].filter(Boolean);
                    if (openings.length > 0) {
                        resolve(openings[Math.floor(Math.random() * openings.length)]);
                        return;
                    }
                }

                const moves = this.orderMoves(engine, rawMoves);
                let bestMove = null;
                const isMaximizing = (engine.activeColor === Chess.WHITE);
                const nodesCount = { val: 0 };

                if (isMaximizing) {
                    let maxEval = -Infinity;
                    for (const move of moves) {
                        engine.makeMoveSilent(move);
                        const score = this.minimax(engine, depth - 1, -Infinity, Infinity, false, nodesCount);
                        engine.undoMoveSilent();

                        if (score > maxEval) {
                            maxEval = score;
                            bestMove = move;
                        }
                    }
                } else {
                    let minEval = Infinity;
                    for (const move of moves) {
                        engine.makeMoveSilent(move);
                        const score = this.minimax(engine, depth - 1, -Infinity, Infinity, true, nodesCount);
                        engine.undoMoveSilent();

                        if (score < minEval) {
                            minEval = score;
                            bestMove = move;
                        }
                    }
                }

                const endTime = performance.now();
                console.log(`AI Search complete in ${(endTime - startTime).toFixed(1)}ms. Depth: ${depth}. Nodes: ${nodesCount.val}.`);
                
                // Fallback to random if bestMove somehow null
                resolve(bestMove || moves[0]);
            }, 50); // Small delay to allow browser thread to draw loading spinner or active highlights
        });
    }
}

window.ChessAI = ChessAI;
