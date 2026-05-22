/**
 * board.js — Interactive Chess Board UI & Animation Controller
 * 
 * Handles:
 * - 60fps hardware-accelerated piece animations (CSS Translate3d)
 * - Click-to-move & Drag-and-drop (Mouse + Touch support)
 * - Move indicators (legal destination dots, captures)
 * - Highlight overlays (selected, last move, king in check)
 * - Web Audio API synthesized sound effects (move, capture, check, castle, game-over)
 * - Flip board view orientation
 * - Promotion overlay panel
 */

'use strict';

const Chess = window.Chess || {};

class ChessBoard {
    /**
     * @param {HTMLElement} containerEl - The wrapper container for the chess board.
     * @param {ChessEngine} engine - The active chess engine instance.
     * @param {Object} options - Configuration options.
     */
    constructor(containerEl, engine, options = {}) {
        this.container = containerEl;
        this.engine = engine;
        
        this.onMoveCallback = options.onMove || (() => {});
        this.onPromotionCallback = options.onPromotion || (() => Promise.resolve(Chess.QUEEN));

        this.isFlipped = false;
        this.selectedSquare = null; // [rank, file]
        this.legalDestinations = []; // List of [r, f] for selected square
        
        // Drag state
        this.dragState = {
            isDragging: false,
            pieceEl: null,
            fromSquare: null,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };

        // Cache of active piece elements: pieceId -> HTMLElement
        this.pieceElements = new Map();

        // Audio Context for sound synthesis
        this.audioCtx = null;

        // Build DOM structure
        this.initDom();
        this.setupEvents();
        this.draw();
    }

    /**
     * Synthesizes audio feedback using the Web Audio API (zero external assets needed).
     * Sound types: 'move', 'capture', 'check', 'castle', 'game-over'
     */
    playSound(type) {
        try {
            // Lazy initialization of AudioContext on first user interaction
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);

            const now = this.audioCtx.currentTime;

            if (type === 'move') {
                // Short, low-mid frequency click/thud
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(120, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'capture') {
                // Higher-pitched snappy impact sound
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(280, now);
                osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'check') {
                // Dual frequency alarm chime
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(554, now + 0.08); // Major third jump
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (type === 'castle') {
                // Quick double slide/thud
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
                osc.frequency.setValueAtTime(130, now + 0.09);
                osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
                gainNode.gain.setValueAtTime(0.25, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
                osc.start(now);
                osc.stop(now + 0.18);
            } else if (type === 'game-over') {
                // Descending sad chord
                osc.type = 'sine';
                osc.frequency.setValueAtTime(330, now);
                osc.frequency.exponentialRampToValueAtTime(220, now + 0.4);
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
            }
        } catch (e) {
            console.warn("Audio synthesis error: ", e);
        }
    }

    /**
     * Initialize DOM structures inside the container element.
     */
    initDom() {
        this.container.innerHTML = '';
        this.container.classList.add('chess-board-wrapper');

        // Create main board square grid
        this.boardEl = document.createElement('div');
        this.boardEl.classList.add('chess-board');
        this.container.appendChild(this.boardEl);

        // Draw static squares and coordinates
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const sq = document.createElement('div');
                sq.classList.add('square');
                sq.dataset.rank = r;
                sq.dataset.file = f;
                this.boardEl.appendChild(sq);
            }
        }

        // Overlays Layer (Highlights, active dots)
        this.overlaysEl = document.createElement('div');
        this.overlaysEl.classList.add('board-overlays-layer');
        this.boardEl.appendChild(this.overlaysEl);

        // Pieces Layer
        this.piecesEl = document.createElement('div');
        this.piecesEl.classList.add('board-pieces-layer');
        this.boardEl.appendChild(this.piecesEl);

        // Board Coordinates (Labels)
        this.filesLabelEl = document.createElement('div');
        this.filesLabelEl.classList.add('board-labels-files');
        this.boardEl.appendChild(this.filesLabelEl);

        this.ranksLabelEl = document.createElement('div');
        this.ranksLabelEl.classList.add('board-labels-ranks');
        this.boardEl.appendChild(this.ranksLabelEl);

        // Promotion Modal Overlay (Hidden by default)
        this.promoEl = document.createElement('div');
        this.promoEl.classList.add('board-promotion-overlay', 'hidden');
        this.boardEl.appendChild(this.promoEl);

        this.updateLabels();
    }

    /**
     * Refreshes ranks and files coordinates text elements.
     */
    updateLabels() {
        this.filesLabelEl.innerHTML = '';
        this.ranksLabelEl.innerHTML = '';

        for (let i = 0; i < 8; i++) {
            const fLabel = document.createElement('span');
            const fileIdx = this.isFlipped ? 7 - i : i;
            fLabel.textContent = Chess.FILES[fileIdx];
            this.filesLabelEl.appendChild(fLabel);

            const rLabel = document.createElement('span');
            const rankIdx = this.isFlipped ? i : 7 - i;
            rLabel.textContent = Chess.RANKS[rankIdx];
            this.ranksLabelEl.appendChild(rLabel);
        }
    }

    /**
     * Flips board view layout.
     */
    flip() {
        this.isFlipped = !this.isFlipped;
        this.container.classList.toggle('flipped', this.isFlipped);
        this.updateLabels();
        
        // Re-apply correct positioning styles on squares & pieces
        const squares = this.boardEl.querySelectorAll('.square');
        squares.forEach(sq => {
            const rank = parseInt(sq.dataset.rank, 10);
            const file = parseInt(sq.dataset.file, 10);
            const pos = this.getVisualCoords(rank, file);
            sq.style.left = `${pos.x * 12.5}%`;
            sq.style.top = `${pos.y * 12.5}%`;
            
            // Adjust light/dark square colors
            sq.className = 'square ' + (((rank + file) % 2 === 0) ? 'dark' : 'light');
        });

        this.draw();
    }

    /**
     * Converts engine grid indices [rank, file] into visual board grid percentages.
     */
    getVisualCoords(rank, file) {
        if (this.isFlipped) {
            return {
                x: 7 - file,
                y: rank
            };
        } else {
            return {
                x: file,
                y: 7 - rank
            };
        }
    }

    /**
     * Converts client pixel position (clientX, clientY) back to [rank, file] indices.
     */
    getSquareFromCoords(clientX, clientY) {
        const rect = this.boardEl.getBoundingClientRect();
        const relativeX = clientX - rect.left;
        const relativeY = clientY - rect.top;

        if (relativeX < 0 || relativeX > rect.width || relativeY < 0 || relativeY > rect.height) {
            return null;
        }

        const filePct = relativeX / rect.width;
        const rankPct = relativeY / rect.height;

        let file = Math.floor(filePct * 8);
        let rank = 7 - Math.floor(rankPct * 8);

        if (this.isFlipped) {
            file = 7 - file;
            rank = Math.floor(rankPct * 8);
        }

        if (Chess.isOnBoard(rank, file)) {
            return [rank, file];
        }
        return null;
    }

    /**
     * Core draw / render sync cycle. Matches pieces layer DOM nodes with current engine.
     */
    draw() {
        const activeIds = new Set();

        // 1. Sync pieces on board
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const piece = this.engine.board[r][f];
                if (piece) {
                    activeIds.add(piece.id);
                    this.syncPieceEl(r, f, piece);
                }
            }
        }

        // 2. Remove captured pieces from DOM
        for (const [id, el] of this.pieceElements.entries()) {
            if (!activeIds.has(id)) {
                el.classList.add('captured');
                // Remove from DOM after fade-out transition completes
                setTimeout(() => {
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                }, 200);
                this.pieceElements.delete(id);
            }
        }

        // 3. Draw Highlights layer
        this.drawHighlights();
    }

    /**
     * Synthesizes or updates a piece DOM element.
     */
    syncPieceEl(rank, file, piece) {
        let el = this.pieceElements.get(piece.id);
        const pos = this.getVisualCoords(rank, file);

        if (!el) {
            // Create new piece node
            el = document.createElement('div');
            el.classList.add('piece');
            el.dataset.id = piece.id;
            el.innerHTML = Chess.getPieceSvgHtml(piece.type, piece.color);

            // Drag-start handlers
            el.addEventListener('mousedown', (e) => this.onDragStart(e, rank, file, el));
            el.addEventListener('touchstart', (e) => this.onDragStart(e, rank, file, el), { passive: false });

            this.piecesEl.appendChild(el);
            this.pieceElements.set(piece.id, el);

            // Trigger enter/fade transition
            requestAnimationFrame(() => {
                el.classList.add('active');
            });
        }

        // Position piece
        el.dataset.rank = rank;
        el.dataset.file = file;

        if (this.dragState.pieceEl !== el) {
            // Apply CSS transform animation
            el.style.transform = `translate3d(${pos.x * 100}%, ${pos.y * 100}%, 0)`;
        }
    }

    /**
     * Renders highlights, check states, and legal move dots.
     */
    drawHighlights() {
        this.overlaysEl.innerHTML = '';

        // 1. Highlight Last Move
        const lastState = this.engine.history[this.engine.history.length - 1];
        if (lastState && lastState.move) {
            const move = lastState.move;
            this.addHighlightSquare(move.from[0], move.from[1], 'last-move-source');
            this.addHighlightSquare(move.to[0], move.to[1], 'last-move-target');
        }

        // 2. Highlight King in Check
        if (this.engine.isInCheck(this.engine.activeColor)) {
            const kingPos = this.engine.findKing(this.engine.activeColor);
            if (kingPos) {
                this.addHighlightSquare(kingPos[0], kingPos[1], 'in-check');
            }
        }

        // 3. Highlight Selected Piece
        if (this.selectedSquare) {
            this.addHighlightSquare(this.selectedSquare[0], this.selectedSquare[1], 'selected');

            // Draw legal moves indicators
            for (const dest of this.legalDestinations) {
                const isCapture = (this.engine.board[dest[0]][dest[1]] !== null) || 
                                  (this.engine.enPassantSquare && this.engine.enPassantSquare[0] === dest[0] && this.engine.enPassantSquare[1] === dest[1]);
                this.addMoveIndicator(dest[0], dest[1], isCapture);
            }
        }
    }

    addHighlightSquare(rank, file, className) {
        const pos = this.getVisualCoords(rank, file);
        const hl = document.createElement('div');
        hl.classList.add('highlight-overlay', className);
        hl.style.left = `${pos.x * 12.5}%`;
        hl.style.top = `${pos.y * 12.5}%`;
        this.overlaysEl.appendChild(hl);
    }

    addMoveIndicator(rank, file, isCapture) {
        const pos = this.getVisualCoords(rank, file);
        const ind = document.createElement('div');
        ind.classList.add('move-indicator', isCapture ? 'capture' : 'dot');
        ind.style.left = `${pos.x * 12.5}%`;
        ind.style.top = `${pos.y * 12.5}%`;

        // Click handler directly on indicator to complete move
        ind.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleTargetSelect(rank, file);
        });

        this.overlaysEl.appendChild(ind);
    }

    /**
     * Input Events Routing setup (Click to move & drag-and-drop orchestration)
     */
    setupEvents() {
        // Universal square click handling
        this.boardEl.addEventListener('click', (e) => {
            if (this.dragState.isDragging) return; // Prevent double trigger
            
            const square = this.getSquareFromCoords(e.clientX, e.clientY);
            if (square) {
                this.handleSquareClick(square[0], square[1]);
            } else {
                this.deselect();
            }
        });

        // Global mouse & touch events for active drag operations
        const onDragMove = (e) => {
            if (!this.dragState.isDragging) return;
            e.preventDefault();

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            this.dragState.currentX = clientX;
            this.dragState.currentY = clientY;

            const dx = this.dragState.currentX - this.dragState.startX;
            const dy = this.dragState.currentY - this.dragState.startY;

            // Apply direct coordinate translation
            this.dragState.pieceEl.style.transform = `translate3d(${dx}px, ${dy}px, 10px)`;
        };

        const onDragEnd = (e) => {
            if (!this.dragState.isDragging) return;

            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

            const fromSq = this.dragState.fromSquare;
            const toSq = this.getSquareFromCoords(clientX, clientY);

            // Re-enable CSS transforms animation properties
            this.dragState.pieceEl.classList.remove('dragging');
            this.dragState.pieceEl.style.zIndex = '';

            const pieceEl = this.dragState.pieceEl;
            
            this.dragState.isDragging = false;
            this.dragState.pieceEl = null;

            if (toSq && (fromSq[0] !== toSq[0] || fromSq[1] !== toSq[1])) {
                // User dropped piece on another square
                const move = this.legalDestinations.find(dest => dest[0] === toSq[0] && dest[1] === toSq[1]);
                if (move) {
                    this.executeUserMove(fromSq, toSq);
                } else {
                    // Snap back
                    this.draw();
                }
            } else {
                // Same square or out of board, snap back but preserve click select
                this.draw();
            }

            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
            document.removeEventListener('touchmove', onDragMove);
            document.removeEventListener('touchend', onDragEnd);
        };

        this.onDragMoveHandler = onDragMove;
        this.onDragEndHandler = onDragEnd;
    }

    onDragStart(e, rank, file, pieceEl) {
        // Only allow active side to select / drag
        const piece = this.engine.board[rank][file];
        if (!piece || piece.color !== this.engine.activeColor) return;

        // Stop browser default dragging
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        this.dragState = {
            isDragging: true,
            pieceEl,
            fromSquare: [rank, file],
            startX: clientX,
            startY: clientY,
            currentX: clientX,
            currentY: clientY
        };

        // Select starting square
        this.selectSquare(rank, file);

        // Prep DOM element for overlay positioning
        pieceEl.classList.add('dragging');
        pieceEl.style.zIndex = '1000';

        document.addEventListener('mousemove', this.onDragMoveHandler);
        document.addEventListener('mouseup', this.onDragEndHandler);
        document.addEventListener('touchmove', this.onDragMoveHandler, { passive: false });
        document.addEventListener('touchend', this.onDragEndHandler);
    }

    /**
     * Decides action on square click.
     */
    handleSquareClick(rank, file) {
        const piece = this.engine.board[rank][file];

        if (this.selectedSquare) {
            // Try to move to the clicked square
            const isLegal = this.legalDestinations.some(dest => dest[0] === rank && dest[1] === file);
            if (isLegal) {
                this.executeUserMove(this.selectedSquare, [rank, file]);
                return;
            }
        }

        // If clicked on own piece, select it
        if (piece && piece.color === this.engine.activeColor) {
            this.selectSquare(rank, file);
        } else {
            this.deselect();
        }
    }

    handleTargetSelect(rank, file) {
        if (this.selectedSquare) {
            this.executeUserMove(this.selectedSquare, [rank, file]);
        }
    }

    selectSquare(rank, file) {
        this.selectedSquare = [rank, file];
        
        // Find legal moves originating from this square
        const moves = this.engine.generateLegalMoves();
        this.legalDestinations = moves
            .filter(m => m.from[0] === rank && m.from[1] === file)
            .map(m => m.to);

        this.drawHighlights();
    }

    deselect() {
        this.selectedSquare = null;
        this.legalDestinations = [];
        this.drawHighlights();
    }

    /**
     * Executes the move after checking for pawn promotion modal.
     */
    async executeUserMove(from, to) {
        const moves = this.engine.generateLegalMoves();
        const move = moves.find(m => m.from[0] === from[0] && m.from[1] === from[1] && m.to[0] === to[0] && m.to[1] === to[1]);

        if (!move) {
            this.deselect();
            return;
        }

        // Handle Pawn Promotion options
        if (move.flags === 'p') {
            const promoChoice = await this.promptPromotion(this.engine.activeColor);
            move.promotion = promoChoice;
        }

        // Store sound effect parameter context
        const isCapture = (move.captured !== null);
        const isCastle = (move.flags === 'c');

        // Play the move on the engine
        this.engine.makeMove(move);

        // Deselect
        this.selectedSquare = null;
        this.legalDestinations = [];

        // Redraw board positions
        this.draw();

        // Sound trigger
        if (this.engine.isInCheck(this.engine.activeColor)) {
            this.playSound('check');
        } else if (isCapture) {
            this.playSound('capture');
        } else if (isCastle) {
            this.playSound('castle');
        } else {
            this.playSound('move');
        }

        // Notify controller
        this.onMoveCallback(move);
    }

    /**
     * Displays a premium modal dialog to pick promotion pieces.
     */
    promptPromotion(color) {
        return new Promise((resolve) => {
            this.promoEl.innerHTML = '';
            this.promoEl.classList.remove('hidden');

            const choices = [
                { type: Chess.QUEEN,  label: 'Queen' },
                { type: Chess.ROOK,   label: 'Rook' },
                { type: Chess.BISHOP, label: 'Bishop' },
                { type: Chess.KNIGHT, label: 'Knight' }
            ];

            choices.forEach(c => {
                const btn = document.createElement('div');
                btn.classList.add('promo-option-btn');
                btn.innerHTML = `
                    <div class="promo-icon">${Chess.getPieceSvgHtml(c.type, color)}</div>
                    <span class="promo-label">${c.label}</span>
                `;
                btn.addEventListener('click', () => {
                    this.promoEl.classList.add('hidden');
                    resolve(c.type);
                });
                this.promoEl.appendChild(btn);
            });
        });
    }
}

window.ChessBoard = ChessBoard;
