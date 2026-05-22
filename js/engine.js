/**
 * engine.js — Chess Engine Core
 * 
 * Implements full FIDE chess rules including all edge cases:
 * - Castling (rights, through check, clear path, etc.)
 * - En Passant (valid for 1 turn after double step, correct capture square)
 * - Pawn Promotion (Q, R, B, N options)
 * - Fifty-move rule (100 half-moves without pawn moves or captures)
 * - Threefold repetition (based on exact position, turn, castling rights, and en passant target square)
 * - Insufficient material (K vs K, KB vs K, KN vs K, KB vs KB same color bishops)
 * - Game state evaluation (Check, Checkmate, Stalemate, Draw by Insufficient Material, 50-Move Rule, Threefold Repetition)
 * - SAN (Standard Algebraic Notation) generation and parsing
 * - History and Undo functionality
 */

'use strict';

const Chess = window.Chess || {};

class ChessEngine {
    constructor(fen = Chess.STARTING_FEN) {
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        this.activeColor = Chess.WHITE;
        this.castlingRights = {
            [Chess.WHITE]: { kingSide: true, queenSide: true },
            [Chess.BLACK]: { kingSide: true, queenSide: true }
        };
        this.enPassantSquare = null; // [rank, file] or null
        this.halfmoveClock = 0;
        this.fullmoveNumber = 1;

        // History tracks state snapshots for undo and threefold repetition
        this.history = [];
        this.pieceIdCounter = 1; // Used to give unique IDs to pieces for UI transitions

        this.load(fen);
    }

    /**
     * Resets the board to the standard starting position.
     */
    reset() {
        this.load(Chess.STARTING_FEN);
    }

    /**
     * Loads a position from a FEN string.
     * Throws an Error if the FEN is invalid.
     */
    load(fen) {
        const parts = fen.trim().split(/\s+/);
        if (parts.length < 4) {
            throw new Error("Invalid FEN: must have at least 4 fields (board, active color, castling, en passant)");
        }

        const boardPart = parts[0];
        const colorPart = parts[1];
        const castlingPart = parts[2];
        const epPart = parts[3];
        const halfmovePart = parts[4] || '0';
        const fullmovePart = parts[5] || '1';

        // 1. Parse Board
        const newBoard = Array(8).fill(null).map(() => Array(8).fill(null));
        const rows = boardPart.split('/');
        if (rows.length !== 8) {
            throw new Error("Invalid FEN: board must have 8 ranks");
        }

        for (let r = 0; r < 8; r++) {
            const row = rows[r];
            let f = 0;
            for (let c = 0; c < row.length; c++) {
                const char = row[c];
                if (/[1-8]/.test(char)) {
                    f += parseInt(char, 10);
                } else if (Chess.FEN_PIECES[char]) {
                    if (f > 7) {
                        throw new Error(`Invalid FEN: row ${r} exceeds 8 files`);
                    }
                    const pieceDef = Chess.FEN_PIECES[char];
                    newBoard[7 - r][f] = {
                        type: pieceDef.type,
                        color: pieceDef.color,
                        id: this.pieceIdCounter++
                    };
                    f++;
                } else {
                    throw new Error(`Invalid FEN: unknown character '${char}'`);
                }
            }
            if (f !== 8) {
                throw new Error(`Invalid FEN: row ${r} does not have exactly 8 files`);
            }
        }

        // 2. Parse Active Color
        let newColor;
        if (colorPart === 'w') {
            newColor = Chess.WHITE;
        } else if (colorPart === 'b') {
            newColor = Chess.BLACK;
        } else {
            throw new Error(`Invalid FEN: unknown active color '${colorPart}'`);
        }

        // 3. Parse Castling Rights
        const newCastling = {
            [Chess.WHITE]: { kingSide: false, queenSide: false },
            [Chess.BLACK]: { kingSide: false, queenSide: false }
        };
        if (castlingPart !== '-') {
            for (let i = 0; i < castlingPart.length; i++) {
                const char = castlingPart[i];
                switch (char) {
                    case 'K': newCastling[Chess.WHITE].kingSide = true; break;
                    case 'Q': newCastling[Chess.WHITE].queenSide = true; break;
                    case 'k': newCastling[Chess.BLACK].kingSide = true; break;
                    case 'q': newCastling[Chess.BLACK].queenSide = true; break;
                    default: throw new Error(`Invalid FEN: unknown castling right '${char}'`);
                }
            }
        }

        // 4. Parse En Passant Square
        let newEp = null;
        if (epPart !== '-') {
            newEp = Chess.algebraicToIndex(epPart);
            if (!newEp) {
                throw new Error(`Invalid FEN: invalid en passant square '${epPart}'`);
            }
        }

        // 5. Halfmove and Fullmove Clocks
        const newHalfmove = parseInt(halfmovePart, 10);
        const newFullmove = parseInt(fullmovePart, 10);
        if (isNaN(newHalfmove) || newHalfmove < 0) {
            throw new Error(`Invalid FEN: invalid halfmove clock '${halfmovePart}'`);
        }
        if (isNaN(newFullmove) || newFullmove <= 0) {
            throw new Error(`Invalid FEN: invalid fullmove number '${fullmovePart}'`);
        }

        // All parsings succeeded, apply state
        this.board = newBoard;
        this.activeColor = newColor;
        this.castlingRights = newCastling;
        this.enPassantSquare = newEp;
        this.halfmoveClock = newHalfmove;
        this.fullmoveNumber = newFullmove;
        this.history = []; // Reset history on fresh load

        // Push initial state to history for threefold repetition
        this.pushHistoryState(null);
    }

    /**
     * Generates the FEN string for the current board position.
     */
    generateFen() {
        const fenRows = [];
        for (let r = 7; r >= 0; r--) {
            let rowStr = '';
            let emptyCount = 0;
            for (let f = 0; f < 8; f++) {
                const piece = this.board[r][f];
                if (piece === null) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        rowStr += emptyCount;
                        emptyCount = 0;
                    }
                    let char = '';
                    switch (piece.type) {
                        case Chess.PAWN:   char = 'P'; break;
                        case Chess.KNIGHT: char = 'N'; break;
                        case Chess.BISHOP: char = 'B'; break;
                        case Chess.ROOK:   char = 'R'; break;
                        case Chess.QUEEN:  char = 'Q'; break;
                        case Chess.KING:   char = 'K'; break;
                    }
                    rowStr += (piece.color === Chess.WHITE) ? char : char.toLowerCase();
                }
            }
            if (emptyCount > 0) {
                rowStr += emptyCount;
            }
            fenRows.push(rowStr);
        }

        const boardPart = fenRows.join('/');
        const colorPart = (this.activeColor === Chess.WHITE) ? 'w' : 'b';

        let castlingPart = '';
        if (this.castlingRights[Chess.WHITE].kingSide) castlingPart += 'K';
        if (this.castlingRights[Chess.WHITE].queenSide) castlingPart += 'Q';
        if (this.castlingRights[Chess.BLACK].kingSide) castlingPart += 'k';
        if (this.castlingRights[Chess.BLACK].queenSide) castlingPart += 'q';
        if (castlingPart === '') castlingPart = '-';

        const epPart = this.enPassantSquare ? Chess.indexToAlgebraic(this.enPassantSquare[0], this.enPassantSquare[1]) : '-';

        return `${boardPart} ${colorPart} ${castlingPart} ${epPart} ${this.halfmoveClock} ${this.fullmoveNumber}`;
    }

    /**
     * Returns the piece at the given indices, or null.
     */
    getPiece(rank, file) {
        if (!Chess.isOnBoard(rank, file)) return null;
        return this.board[rank][file];
    }

    /**
     * Checks if a square is attacked by any piece of the specified attackerColor.
     */
    isSquareAttacked(rank, file, attackerColor) {
        // 1. Pawn Attacks
        const pawnRankDir = (attackerColor === Chess.WHITE) ? -1 : 1;
        const attackPawnRank = rank + pawnRankDir;
        if (Chess.isOnBoard(attackPawnRank, file - 1)) {
            const p = this.board[attackPawnRank][file - 1];
            if (p && p.type === Chess.PAWN && p.color === attackerColor) return true;
        }
        if (Chess.isOnBoard(attackPawnRank, file + 1)) {
            const p = this.board[attackPawnRank][file + 1];
            if (p && p.type === Chess.PAWN && p.color === attackerColor) return true;
        }

        // 2. Knight Attacks
        for (const [dr, df] of Chess.DIRECTIONS.KNIGHT) {
            const nr = rank + dr;
            const nf = file + df;
            if (Chess.isOnBoard(nr, nf)) {
                const p = this.board[nr][nf];
                if (p && p.type === Chess.KNIGHT && p.color === attackerColor) return true;
            }
        }

        // 3. Sliding Attacks: Orthogonal (Rook & Queen)
        for (const [dr, df] of Chess.DIRECTIONS.ORTHOGONAL) {
            let nr = rank + dr;
            let nf = file + df;
            while (Chess.isOnBoard(nr, nf)) {
                const p = this.board[nr][nf];
                if (p) {
                    if (p.color === attackerColor && (p.type === Chess.ROOK || p.type === Chess.QUEEN)) {
                        return true;
                    }
                    break; // Blocked
                }
                nr += dr;
                nf += df;
            }
        }

        // 4. Sliding Attacks: Diagonal (Bishop & Queen)
        for (const [dr, df] of Chess.DIRECTIONS.DIAGONAL) {
            let nr = rank + dr;
            let nf = file + df;
            while (Chess.isOnBoard(nr, nf)) {
                const p = this.board[nr][nf];
                if (p) {
                    if (p.color === attackerColor && (p.type === Chess.BISHOP || p.type === Chess.QUEEN)) {
                        return true;
                    }
                    break; // Blocked
                }
                nr += dr;
                nf += df;
            }
        }

        // 5. King Attacks (stops king-on-king moves)
        for (const [dr, df] of Chess.DIRECTIONS.KING) {
            const nr = rank + dr;
            const nf = file + df;
            if (Chess.isOnBoard(nr, nf)) {
                const p = this.board[nr][nf];
                if (p && p.type === Chess.KING && p.color === attackerColor) return true;
            }
        }

        return false;
    }

    /**
     * Locates the king of the specified color.
     */
    findKing(color) {
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const p = this.board[r][f];
                if (p && p.type === Chess.KING && p.color === color) {
                    return [r, f];
                }
            }
        }
        return null;
    }

    /**
     * Returns true if the specified color is currently in check.
     */
    isInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false; // Fail-safe (should never happen in legal setups)
        return this.isSquareAttacked(kingPos[0], kingPos[1], Chess.oppositeColor(color));
    }

    /**
     * Generates all pseudo-legal moves for the active color.
     * Moves are objects: { from: [r, f], to: [r, f], piece, captured, flags }
     * Flags: 'n' (normal), 'd' (double pawn push), 'c' (castling), 'e' (en passant), 'p' (promotion)
     */
    generatePseudoLegalMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const piece = this.board[r][f];
                if (piece && piece.color === color) {
                    this.generatePieceMoves(r, f, piece, moves);
                }
            }
        }
        return moves;
    }

    /**
     * Appends piece-specific moves to the moves list.
     */
    generatePieceMoves(rank, file, piece, moves) {
        const color = piece.color;
        const oppColor = Chess.oppositeColor(color);

        switch (piece.type) {
            case Chess.PAWN: {
                const rankDir = (color === Chess.WHITE) ? 1 : -1;
                const startRank = (color === Chess.WHITE) ? 1 : 6;
                const promoRank = (color === Chess.WHITE) ? 7 : 0;

                // 1. One step forward
                const nextRank = rank + rankDir;
                if (Chess.isOnBoard(nextRank, file) && !this.board[nextRank][file]) {
                    if (nextRank === promoRank) {
                        // Promotion
                        for (const promoType of [Chess.QUEEN, Chess.ROOK, Chess.BISHOP, Chess.KNIGHT]) {
                            moves.push({
                                from: [rank, file],
                                to: [nextRank, file],
                                piece,
                                captured: null,
                                promotion: promoType,
                                flags: 'p'
                            });
                        }
                    } else {
                        moves.push({
                            from: [rank, file],
                            to: [nextRank, file],
                            piece,
                            captured: null,
                            flags: 'n'
                        });

                        // 2. Double step forward (only if first square is empty and on start rank)
                        const doubleRank = rank + 2 * rankDir;
                        if (rank === startRank && Chess.isOnBoard(doubleRank, file) && !this.board[doubleRank][file]) {
                            moves.push({
                                from: [rank, file],
                                to: [doubleRank, file],
                                piece,
                                captured: null,
                                flags: 'd'
                            });
                        }
                    }
                }

                // 3. Captures (diagonals)
                const attackFiles = [file - 1, file + 1];
                for (const af of attackFiles) {
                    if (Chess.isOnBoard(nextRank, af)) {
                        const targetPiece = this.board[nextRank][af];
                        if (targetPiece && targetPiece.color === oppColor) {
                            if (nextRank === promoRank) {
                                for (const promoType of [Chess.QUEEN, Chess.ROOK, Chess.BISHOP, Chess.KNIGHT]) {
                                    moves.push({
                                        from: [rank, file],
                                        to: [nextRank, af],
                                        piece,
                                        captured: targetPiece,
                                        promotion: promoType,
                                        flags: 'p'
                                    });
                                }
                            } else {
                                moves.push({
                                    from: [rank, file],
                                    to: [nextRank, af],
                                    piece,
                                    captured: targetPiece,
                                    flags: 'n'
                                });
                            }
                        }

                        // En Passant capture
                        if (this.enPassantSquare && this.enPassantSquare[0] === nextRank && this.enPassantSquare[1] === af) {
                            // En Passant captures the pawn on the current rank, target file
                            const capturedPawn = this.board[rank][af];
                            moves.push({
                                from: [rank, file],
                                to: [nextRank, af],
                                piece,
                                captured: capturedPawn,
                                flags: 'e'
                            });
                        }
                    }
                }
                break;
            }

            case Chess.KNIGHT: {
                for (const [dr, df] of Chess.DIRECTIONS.KNIGHT) {
                    const nr = rank + dr;
                    const nf = file + df;
                    if (Chess.isOnBoard(nr, nf)) {
                        const target = this.board[nr][nf];
                        if (!target || target.color === oppColor) {
                            moves.push({
                                from: [rank, file],
                                to: [nr, nf],
                                piece,
                                captured: target,
                                flags: 'n'
                            });
                        }
                    }
                }
                break;
            }

            case Chess.BISHOP:
            case Chess.ROOK:
            case Chess.QUEEN: {
                const dirs = (piece.type === Chess.BISHOP) ? Chess.DIRECTIONS.DIAGONAL :
                             (piece.type === Chess.ROOK) ? Chess.DIRECTIONS.ORTHOGONAL :
                             Chess.DIRECTIONS.KING; // Queen can do both orthogonal & diagonal (same as King directions list)
                
                for (const [dr, df] of dirs) {
                    let nr = rank + dr;
                    let nf = file + df;
                    while (Chess.isOnBoard(nr, nf)) {
                        const target = this.board[nr][nf];
                        if (!target) {
                            moves.push({
                                from: [rank, file],
                                to: [nr, nf],
                                piece,
                                captured: null,
                                flags: 'n'
                            });
                        } else {
                            if (target.color === oppColor) {
                                moves.push({
                                    from: [rank, file],
                                    to: [nr, nf],
                                    piece,
                                    captured: target,
                                    flags: 'n'
                                });
                            }
                            break; // Blocked by piece
                        }
                        nr += dr;
                        nf += df;
                    }
                }
                break;
            }

            case Chess.KING: {
                // 1. Normal steps
                for (const [dr, df] of Chess.DIRECTIONS.KING) {
                    const nr = rank + dr;
                    const nf = file + df;
                    if (Chess.isOnBoard(nr, nf)) {
                        const target = this.board[nr][nf];
                        if (!target || target.color === oppColor) {
                            moves.push({
                                from: [rank, file],
                                to: [nr, nf],
                                piece,
                                captured: target,
                                flags: 'n'
                            });
                        }
                    }
                }

                // 2. Castling
                // Cannot castle if currently in check
                if (!this.isInCheck(color)) {
                    const rights = this.castlingRights[color];
                    const kRank = (color === Chess.WHITE) ? 0 : 7;

                    // King-side Castling
                    if (rights.kingSide) {
                        // Squares between King (f=4) and Rook (f=7) must be empty: f=5, f=6
                        if (!this.board[kRank][5] && !this.board[kRank][6]) {
                            // Squares the king passes through (f=5, f=6) must not be under attack
                            if (!this.isSquareAttacked(kRank, 5, oppColor) && !this.isSquareAttacked(kRank, 6, oppColor)) {
                                moves.push({
                                    from: [rank, file],
                                    to: [kRank, 6],
                                    piece,
                                    captured: null,
                                    flags: 'c'
                                });
                            }
                        }
                    }

                    // Queen-side Castling
                    if (rights.queenSide) {
                        // Squares between King (f=4) and Rook (f=0) must be empty: f=1, f=2, f=3
                        if (!this.board[kRank][1] && !this.board[kRank][2] && !this.board[kRank][3]) {
                            // Squares the king passes through/lands on (f=2, f=3) must not be under attack.
                            // Note: FIDE rules specify the King must not pass through check (f=3) or land on check (f=2).
                            // The rook's path (f=1) being attacked is allowed.
                            if (!this.isSquareAttacked(kRank, 3, oppColor) && !this.isSquareAttacked(kRank, 2, oppColor)) {
                                moves.push({
                                    from: [rank, file],
                                    to: [kRank, 2],
                                    piece,
                                    captured: null,
                                    flags: 'c'
                                });
                            }
                        }
                    }
                }
                break;
            }
        }
    }

    /**
     * Returns all strictly legal moves for the active color.
     */
    generateLegalMoves() {
        const pseudo = this.generatePseudoLegalMoves(this.activeColor);
        const legal = [];

        for (const move of pseudo) {
            // Simulate the move
            this.makeMoveSilent(move);
            // Check if king is in check after the move
            if (!this.isInCheck(Chess.oppositeColor(this.activeColor))) {
                legal.push(move);
            }
            // Undo simulated move
            this.undoMoveSilent();
        }

        return legal;
    }

    /**
     * Executes a legal move on the engine. Updates game state, logs history, etc.
     */
    makeMove(move) {
        // Deep copy castling rights for logging history
        const prevEpSquare = this.enPassantSquare;
        const prevHalfmove = this.halfmoveClock;
        const prevFullmove = this.fullmoveNumber;

        const from = move.from;
        const to = move.to;
        const piece = this.board[from[0]][from[1]];
        const captured = move.captured;

        // Perform the move on the board
        this.board[from[0]][from[1]] = null;

        // Move piece
        let finalPiece = { ...piece };
        if (move.flags === 'p') {
            finalPiece.type = move.promotion;
            // Retain the same piece ID for animation continuity if wanted, or new ID to signify transformation.
            // Let's retain ID, it makes the animation of promotion smoother.
        }

        this.board[to[0]][to[1]] = finalPiece;

        // Special handling
        // En Passant capture
        if (move.flags === 'e') {
            // Captured pawn is on the same rank as 'from' and same file as 'to'
            this.board[from[0]][to[1]] = null;
        }

        // Castling (Move the Rook as well)
        if (move.flags === 'c') {
            const kRank = to[0];
            if (to[1] === 6) {
                // King Side: Rook goes from f=7 to f=5
                const rook = this.board[kRank][7];
                this.board[kRank][7] = null;
                this.board[kRank][5] = rook;
            } else if (to[1] === 2) {
                // Queen Side: Rook goes from f=0 to f=3
                const rook = this.board[kRank][0];
                this.board[kRank][0] = null;
                this.board[kRank][3] = rook;
            }
        }

        // Update Castling Rights
        // If King moves, lose all castling rights for that color
        if (piece.type === Chess.KING) {
            this.castlingRights[piece.color].kingSide = false;
            this.castlingRights[piece.color].queenSide = false;
        }
        // If Rook moves, lose corresponding castling right
        if (piece.type === Chess.ROOK) {
            const side = (from[1] === 7) ? 'kingSide' : (from[1] === 0) ? 'queenSide' : null;
            if (side) {
                this.castlingRights[piece.color][side] = false;
            }
        }
        // If a Rook is captured, opponent loses castling rights for that rook
        if (captured && captured.type === Chess.ROOK) {
            const oppColor = Chess.oppositeColor(piece.color);
            const side = (to[1] === 7) ? 'kingSide' : (to[1] === 0) ? 'queenSide' : null;
            if (side && to[0] === ((oppColor === Chess.WHITE) ? 0 : 7)) {
                this.castlingRights[oppColor][side] = false;
            }
        }

        // Update En Passant target square
        if (move.flags === 'd') {
            // Square behind the double stepped pawn
            const rankDir = (piece.color === Chess.WHITE) ? 1 : -1;
            this.enPassantSquare = [from[0] + rankDir, from[1]];
        } else {
            this.enPassantSquare = null;
        }

        // Update halfmove clock (fifty-move rule): Reset on pawn move or capture, increment otherwise
        if (piece.type === Chess.PAWN || captured !== null) {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock++;
        }

        // Increment fullmove number if black just completed their turn
        if (this.activeColor === Chess.BLACK) {
            this.fullmoveNumber++;
        }

        // Toggle active color
        this.activeColor = Chess.oppositeColor(this.activeColor);

        // Push state to history
        this.pushHistoryState(move);
    }

    /**
     * Reverts the last move made.
     */
    undoMove() {
        if (this.history.length <= 1) return null; // Initial state remains

        const state = this.history.pop();
        const prevMove = state.move;

        // Restore engine state to the previous snapshot in history
        const prevState = this.history[this.history.length - 1];
        this.restoreStateFromSnapshot(prevState);

        return prevMove;
    }

    /**
     * Silent equivalents of makeMove and undoMove for legal move generation simulation.
     * Keeps code decoupled and clear.
     */
    makeMoveSilent(move) {
        this.makeMove(move);
    }

    undoMoveSilent() {
        this.undoMove();
    }

    /**
     * Snapshots the current game state and pushes it to history.
     */
    pushHistoryState(move) {
        const boardCopy = this.board.map(row => row.map(cell => cell ? { ...cell } : null));
        const rightsCopy = {
            [Chess.WHITE]: { ...this.castlingRights[Chess.WHITE] },
            [Chess.BLACK]: { ...this.castlingRights[Chess.BLACK] }
        };
        const epCopy = this.enPassantSquare ? [this.enPassantSquare[0], this.enPassantSquare[1]] : null;

        // Generate position signature for threefold repetition
        const signature = this.getPositionRepetitionSignature();

        this.history.push({
            board: boardCopy,
            activeColor: this.activeColor,
            castlingRights: rightsCopy,
            enPassantSquare: epCopy,
            halfmoveClock: this.halfmoveClock,
            fullmoveNumber: this.fullmoveNumber,
            signature: signature,
            move: move
        });
    }

    /**
     * Restores state from a given history snapshot.
     */
    restoreStateFromSnapshot(state) {
        this.board = state.board.map(row => row.map(cell => cell ? { ...cell } : null));
        this.activeColor = state.activeColor;
        this.castlingRights = {
            [Chess.WHITE]: { ...state.castlingRights[Chess.WHITE] },
            [Chess.BLACK]: { ...state.castlingRights[Chess.BLACK] }
        };
        this.enPassantSquare = state.enPassantSquare ? [state.enPassantSquare[0], state.enPassantSquare[1]] : null;
        this.halfmoveClock = state.halfmoveClock;
        this.fullmoveNumber = state.fullmoveNumber;
    }

    /**
     * Computes a simplified signature for the position to detect threefold repetition.
     * Repetition requires matching piece placement, active turn, castling rights, and en passant status.
     */
    getPositionRepetitionSignature() {
        // Build FEN-like signature but omit fullmove and halfmove clocks
        const fenRows = [];
        for (let r = 7; r >= 0; r--) {
            let rowStr = '';
            let emptyCount = 0;
            for (let f = 0; f < 8; f++) {
                const piece = this.board[r][f];
                if (piece === null) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        rowStr += emptyCount;
                        emptyCount = 0;
                    }
                    let char = '';
                    switch (piece.type) {
                        case Chess.PAWN:   char = 'P'; break;
                        case Chess.KNIGHT: char = 'N'; break;
                        case Chess.BISHOP: char = 'B'; break;
                        case Chess.ROOK:   char = 'R'; break;
                        case Chess.QUEEN:  char = 'Q'; break;
                        case Chess.KING:   char = 'K'; break;
                    }
                    rowStr += (piece.color === Chess.WHITE) ? char : char.toLowerCase();
                }
            }
            if (emptyCount > 0) {
                rowStr += emptyCount;
            }
            fenRows.push(rowStr);
        }

        const boardPart = fenRows.join('/');
        const colorPart = (this.activeColor === Chess.WHITE) ? 'w' : 'b';

        let castlingPart = '';
        if (this.castlingRights[Chess.WHITE].kingSide) castlingPart += 'K';
        if (this.castlingRights[Chess.WHITE].queenSide) castlingPart += 'Q';
        if (this.castlingRights[Chess.BLACK].kingSide) castlingPart += 'k';
        if (this.castlingRights[Chess.BLACK].queenSide) castlingPart += 'q';
        if (castlingPart === '') castlingPart = '-';

        // Note: For threefold repetition, en passant target square only matches if there is a legal en passant capture possible.
        // For simplicity and alignment with standard engines, we include the EP square only.
        const epPart = this.enPassantSquare ? Chess.indexToAlgebraic(this.enPassantSquare[0], this.enPassantSquare[1]) : '-';

        return `${boardPart}|${colorPart}|${castlingPart}|${epPart}`;
    }

    /**
     * Determines if the current position has occurred 3 or more times.
     */
    isThreefoldRepetition() {
        if (this.history.length < 5) return false; // Early return for speed
        const currentSig = this.history[this.history.length - 1].signature;
        let count = 0;
        for (let i = 0; i < this.history.length; i++) {
            if (this.history[i].signature === currentSig) {
                count++;
            }
        }
        return count >= 3;
    }

    /**
     * Check if material on the board is insufficient to checkmate.
     * Insufficient material combinations:
     * - K vs K
     * - K + B vs K
     * - K + N vs K
     * - K + B vs K + B (with bishops on the same color squares)
     */
    isInsufficientMaterial() {
        let whitePieces = [];
        let blackPieces = [];

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const piece = this.board[r][f];
                if (piece) {
                    const info = { type: piece.type, rank: r, file: f };
                    if (piece.color === Chess.WHITE) {
                        whitePieces.push(info);
                    } else {
                        blackPieces.push(info);
                    }
                }
            }
        }

        // Must always have kings
        if (whitePieces.length > 2 || blackPieces.length > 2) return false;

        const wLen = whitePieces.length;
        const bLen = blackPieces.length;

        // 1. King vs King
        if (wLen === 1 && bLen === 1) return true;

        // 2. King + Bishop vs King
        if ((wLen === 2 && bLen === 1 && whitePieces.some(p => p.type === Chess.BISHOP)) ||
            (bLen === 2 && wLen === 1 && blackPieces.some(p => p.type === Chess.BISHOP))) {
            return true;
        }

        // 3. King + Knight vs King
        if ((wLen === 2 && bLen === 1 && whitePieces.some(p => p.type === Chess.KNIGHT)) ||
            (bLen === 2 && wLen === 1 && blackPieces.some(p => p.type === Chess.KNIGHT))) {
            return true;
        }

        // 4. King + Bishop vs King + Bishop (Bishops on same color squares)
        if (wLen === 2 && bLen === 2) {
            const wBishop = whitePieces.find(p => p.type === Chess.BISHOP);
            const bBishop = blackPieces.find(p => p.type === Chess.BISHOP);
            if (wBishop && bBishop) {
                const wColor = (wBishop.rank + wBishop.file) % 2;
                const bColor = (bBishop.rank + bBishop.file) % 2;
                if (wColor === bColor) return true;
            }
        }

        return false;
    }

    /**
     * Determines current state of the game.
     * Returns one of: PLAYING, CHECK, CHECKMATE, STALEMATE, DRAW_INSUFFICIENT, DRAW_FIFTY_MOVE, DRAW_THREEFOLD.
     */
    getGameState() {
        const legalMoves = this.generateLegalMoves();
        const inCheck = this.isInCheck(this.activeColor);

        if (legalMoves.length === 0) {
            if (inCheck) {
                return Chess.CHECKMATE;
            } else {
                return Chess.STALEMATE;
            }
        }

        // Draw by threefold repetition
        if (this.isThreefoldRepetition()) {
            return Chess.DRAW_THREEFOLD;
        }

        // Draw by fifty-move rule
        if (this.halfmoveClock >= 100) { // 50 full moves = 100 half-moves
            return Chess.DRAW_FIFTY_MOVE;
        }

        // Draw by insufficient material
        if (this.isInsufficientMaterial()) {
            return Chess.DRAW_INSUFFICIENT;
        }

        if (inCheck) {
            return Chess.CHECK;
        }

        return Chess.PLAYING;
    }

    /**
     * Converts a raw move object into a Standard Algebraic Notation (SAN) string.
     * Must be called BEFORE actually executing the move on the engine (since it requires disambiguation checks on the current state).
     */
    moveToSan(move) {
        if (move.flags === 'c') {
            return (move.to[1] === 6) ? 'O-O' : 'O-O-O';
        }

        const from = move.from;
        const to = move.to;
        const piece = this.board[from[0]][from[1]];
        if (!piece) return '';

        let san = '';

        if (piece.type !== Chess.PAWN) {
            san += Chess.PIECE_LETTERS[piece.type];

            // Disambiguation
            // Generate all pseudo-legal moves for this piece type that could land on the same target square
            const legalMoves = this.generateLegalMoves();
            const matchingMoves = legalMoves.filter(m => 
                m.to[0] === to[0] && 
                m.to[1] === to[1] && 
                this.board[m.from[0]][m.from[1]] &&
                this.board[m.from[0]][m.from[1]].type === piece.type &&
                (m.from[0] !== from[0] || m.from[1] !== from[1])
            );

            if (matchingMoves.length > 0) {
                // If files are different, disambiguate by file
                const fileDiff = matchingMoves.every(m => m.from[1] !== from[1]);
                const rankDiff = matchingMoves.every(m => m.from[0] !== from[0]);

                if (fileDiff) {
                    san += Chess.FILES[from[1]];
                } else if (rankDiff) {
                    san += Chess.RANKS[from[0]];
                } else {
                    // Both file and rank are needed
                    san += Chess.FILES[from[1]] + Chess.RANKS[from[0]];
                }
            }
        }

        // Capture marker
        if (move.captured !== null) {
            if (piece.type === Chess.PAWN) {
                // Pawn captures must show starting file
                san += Chess.FILES[from[1]];
            }
            san += 'x';
        }

        // Destination square
        san += Chess.indexToAlgebraic(to[0], to[1]);

        // Promotion
        if (move.flags === 'p') {
            san += '=' + Chess.PIECE_LETTERS[move.promotion];
        }

        // Check or Checkmate symbols (requires checking state *after* the simulated move)
        this.makeMoveSilent(move);
        const nextState = this.getGameState();
        this.undoMoveSilent();

        if (nextState === Chess.CHECKMATE) {
            san += '#';
        } else if (nextState === Chess.CHECK) {
            san += '+';
        }

        return san;
    }

    /**
     * Parses a SAN string for the active color and returns the corresponding Move object.
     * Returns null if notation is invalid or ambiguous.
     */
    parseSan(san) {
        const cleanSan = san.replace(/[+#?!=x]/g, '').trim();

        // Castling
        if (cleanSan === 'O-O' || cleanSan === 'O-O-O' || cleanSan === '0-0' || cleanSan === '0-0-0') {
            const kingSide = (cleanSan.length === 3 || cleanSan === '0-0');
            const targetFile = kingSide ? 6 : 2;
            const legalMoves = this.generateLegalMoves();
            const castlingMove = legalMoves.find(m => m.flags === 'c' && m.to[1] === targetFile);
            return castlingMove || null;
        }

        // Parse promotion type
        let promotionType = null;
        const promoMatch = san.match(/=([NnBbRrQq])/);
        if (promoMatch) {
            const char = promoMatch[1].toUpperCase();
            if (char === 'N') promotionType = Chess.KNIGHT;
            if (char === 'B') promotionType = Chess.BISHOP;
            if (char === 'R') promotionType = Chess.ROOK;
            if (char === 'Q') promotionType = Chess.QUEEN;
        }

        // Parse target square and piece letter
        // Strip out captures and checks
        let searchSan = cleanSan.replace(/[KNBRQ]/, '');
        if (promoMatch) {
            searchSan = searchSan.split('=')[0];
        }
        if (searchSan.length < 2) return null;

        const targetSqStr = searchSan.slice(-2);
        const targetSq = Chess.algebraicToIndex(targetSqStr);
        if (!targetSq) return null;

        // Piece type check
        let pieceType = Chess.PAWN;
        const pieceChar = cleanSan[0];
        if (/[KNBRQ]/.test(pieceChar)) {
            if (pieceChar === 'N') pieceType = Chess.KNIGHT;
            if (pieceChar === 'B') pieceType = Chess.BISHOP;
            if (pieceChar === 'R') pieceType = Chess.ROOK;
            if (pieceChar === 'Q') pieceType = Chess.QUEEN;
            if (pieceChar === 'K') pieceType = Chess.KING;
        }

        // Disambiguation indicators
        let disambFile = null;
        let disambRank = null;
        const disambPart = searchSan.slice(0, -2);
        for (let i = 0; i < disambPart.length; i++) {
            const char = disambPart[i];
            if (/[a-h]/.test(char)) disambFile = char.charCodeAt(0) - 97;
            if (/[1-8]/.test(char)) disambRank = parseInt(char, 10) - 1;
        }

        // Search for matching legal moves
        const legalMoves = this.generateLegalMoves();
        const matches = legalMoves.filter(move => {
            if (move.to[0] !== targetSq[0] || move.to[1] !== targetSq[1]) return false;
            const fromPiece = this.board[move.from[0]][move.from[1]];
            if (!fromPiece || fromPiece.type !== pieceType) return false;
            if (disambFile !== null && move.from[1] !== disambFile) return false;
            if (disambRank !== null && move.from[0] !== disambRank) return false;
            if (promotionType !== null && move.promotion !== promotionType) return false;
            return true;
        });

        return matches.length === 1 ? matches[0] : null;
    }
}

window.ChessEngine = ChessEngine;
