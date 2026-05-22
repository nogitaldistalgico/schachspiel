/**
 * app.js — Main Application Orchestrator
 * 
 * Sets up game state, timers, AI players, game logs,
 * import/export features, and updates user interface panels.
 */

'use strict';

var Chess = window.Chess || {};

class ChessApp {
    constructor() {
        this.engine = new ChessEngine();

        // Timers
        this.timerConfig = {
            enabled: true,
            initialMinutes: 10,
            incrementSeconds: 0
        };
        this.timers = {
            [Chess.WHITE]: 600,
            [Chess.BLACK]: 600
        };
        this.timerInterval = null;

        // UI DOM Elements Cache
        this.dom = {
            boardContainer: document.getElementById('board-container'),
            timerSelect: document.getElementById('timer-setting'),
            boardThemeSelect: document.getElementById('board-theme'),
            autoFlipSelect: document.getElementById('auto-flip'),
            
            // Buttons
            restartBtn: document.getElementById('btn-restart'),
            undoBtn: document.getElementById('btn-undo'),
            flipBtn: document.getElementById('btn-flip'),
            drawBtn: document.getElementById('btn-draw'),
            resignBtn: document.getElementById('btn-resign'),
            exportFenBtn: document.getElementById('btn-export-fen'),
            importFenBtn: document.getElementById('btn-import-fen'),
            importPgnBtn: document.getElementById('btn-import-pgn'),
            
            // Displays
            turnIndicator: document.getElementById('turn-indicator'),
            gameStateIndicator: document.getElementById('game-state-indicator'),
            whiteTimer: document.getElementById('timer-white'),
            blackTimer: document.getElementById('timer-black'),
            moveLogBody: document.getElementById('move-log-body'),
            capturedWhiteContainer: document.getElementById('captured-white'),
            capturedBlackContainer: document.getElementById('captured-black'),
            
            // Modals
            gameOverOverlay: document.getElementById('game-over-overlay'),
            gameOverTitle: document.getElementById('game-over-title'),
            gameOverReason: document.getElementById('game-over-reason'),
            gameOverRestartBtn: document.getElementById('btn-game-over-restart'),
            
            confirmOverlay: document.getElementById('confirm-overlay'),
            confirmTitle: document.getElementById('confirm-title'),
            confirmReason: document.getElementById('confirm-reason'),
            confirmYesBtn: document.getElementById('btn-confirm-yes'),
            confirmNoBtn: document.getElementById('btn-confirm-no'),
            
            // Clipboard text areas
            fenInput: document.getElementById('fen-io-box'),
            pgnInput: document.getElementById('pgn-io-box')
        };

        // Initialize Board Component
        this.board = new ChessBoard(this.dom.boardContainer, this.engine, {
            onMove: (move) => this.handleMoveCompleted(move)
        });

        this.setupEventListeners();
        
        // Initial theme setup
        this.changeTheme(this.dom.boardThemeSelect.value);
        
        this.resetGame();
    }

    setupEventListeners() {
        this.dom.timerSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'none') {
                this.timerConfig.enabled = false;
            } else {
                this.timerConfig.enabled = true;
                const [min, inc] = val.split('+').map(Number);
                this.timerConfig.initialMinutes = min;
                this.timerConfig.incrementSeconds = inc;
            }
            this.resetGame();
        });

        this.dom.boardThemeSelect.addEventListener('change', (e) => {
            this.changeTheme(e.target.value);
        });

        // Button Click handlers
        this.dom.restartBtn.addEventListener('click', () => this.resetGame());
        this.dom.gameOverRestartBtn.addEventListener('click', () => {
            this.dom.gameOverOverlay.classList.add('hidden');
            this.resetGame();
        });

        this.dom.undoBtn.addEventListener('click', () => this.handleUndo());
        this.dom.flipBtn.addEventListener('click', () => this.board.flip());
        this.dom.drawBtn.addEventListener('click', () => this.promptDrawOffer());
        this.dom.resignBtn.addEventListener('click', () => this.promptResignation());

        this.dom.exportFenBtn.addEventListener('click', () => {
            const fen = this.engine.generateFen();
            this.dom.fenInput.value = fen;
            this.dom.fenInput.select();
            navigator.clipboard.writeText(fen);
            alert("FEN string copied to clipboard!");
        });

        this.dom.importFenBtn.addEventListener('click', () => {
            const fen = this.dom.fenInput.value.trim();
            if (!fen) return;
            try {
                this.engine.load(fen);
                this.board.deselect();
                
                // Align manually loaded FEN turn to correct flip state if auto-flip is on
                if (this.dom.autoFlipSelect.value === 'yes') {
                    const expectedFlip = (this.engine.activeColor === Chess.BLACK);
                    if (this.board.isFlipped !== expectedFlip) {
                        this.board.flip();
                    }
                }
                
                this.board.draw();
                this.syncGameUi();
                this.resetTimerState();
                alert("FEN loaded successfully!");
            } catch (err) {
                alert("Error loading FEN: " + err.message);
            }
        });

        this.dom.importPgnBtn.addEventListener('click', () => {
            const pgn = this.dom.pgnInput.value.trim();
            if (!pgn) return;
            this.loadPgn(pgn);
        });
    }

    changeTheme(theme) {
        document.body.classList.remove('theme-forest', 'theme-neon', 'theme-wood', 'theme-glass', 'theme-gold');
        document.body.classList.add(`theme-${theme}`);
    }

    /**
     * Resets the board, engine state, timers, and active panels.
     */
    resetGame() {
        this.stopTimer();

        // Adjust board flip state back to default (White on bottom)
        if (this.board.isFlipped) {
            this.board.flip();
        }

        // Reset Engine
        this.engine.reset();
        this.board.deselect();
        this.board.draw();

        // Reset Clocks
        this.resetTimerState();

        // Update Panels
        this.syncGameUi();
    }

    resetTimerState() {
        this.timers[Chess.WHITE] = this.timerConfig.initialMinutes * 60;
        this.timers[Chess.BLACK] = this.timerConfig.initialMinutes * 60;
        this.updateTimerDisplay();

        if (this.timerConfig.enabled) {
            this.dom.whiteTimer.classList.remove('disabled');
            this.dom.blackTimer.classList.remove('disabled');
        } else {
            this.dom.whiteTimer.classList.add('disabled');
            this.dom.blackTimer.classList.add('disabled');
        }
    }

    startTimer() {
        if (!this.timerConfig.enabled) return;
        this.stopTimer();

        this.timerInterval = setInterval(() => {
            const activeColor = this.engine.activeColor;
            this.timers[activeColor]--;

            if (this.timers[activeColor] <= 0) {
                this.timers[activeColor] = 0;
                this.handleTimeout(activeColor);
            }

            this.updateTimerDisplay();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        const formatTime = (totalSeconds) => {
            const min = Math.floor(totalSeconds / 60);
            const sec = totalSeconds % 60;
            return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        };

        this.dom.whiteTimer.textContent = formatTime(this.timers[Chess.WHITE]);
        this.dom.blackTimer.textContent = formatTime(this.timers[Chess.BLACK]);

        // Active Clock highlight class
        this.dom.whiteTimer.classList.toggle('active', this.timerConfig.enabled && this.engine.activeColor === Chess.WHITE);
        this.dom.blackTimer.classList.toggle('active', this.timerConfig.enabled && this.engine.activeColor === Chess.BLACK);
    }

    /**
     * Executes when a turn runs out of time.
     */
    handleTimeout(losingColor) {
        this.stopTimer();
        this.board.playSound('game-over');

        const winningColorName = (losingColor === Chess.WHITE) ? 'Black' : 'White';
        this.showGameOverModal(`${winningColorName} Wins!`, `On time (flagged).`);
    }

    /**
     * Reverts last move. Handles AI pair rollback in PvE mode.
     */
    handleUndo() {
        if (this.engine.history.length <= 1) return;

        // Stop timer temporarily
        this.stopTimer();

        this.engine.undoMove();

        // Auto-align flip state to the restored active player's turn if auto-flip is on
        const autoFlipVal = this.dom.autoFlipSelect.value;
        if (autoFlipVal === 'yes') {
            const activeColor = this.engine.activeColor;
            const expectedFlip = (activeColor === Chess.BLACK);
            if (this.board.isFlipped !== expectedFlip) {
                this.board.flip();
            }
        }

        this.board.deselect();
        this.board.draw();
        this.syncGameUi();

        // Resume timer if game continues
        if (this.engine.getGameState() === Chess.PLAYING || this.engine.getGameState() === Chess.CHECK) {
            this.startTimer();
        }
    }

    /**
     * Main event hook called whenever a move has completed.
     */
    handleMoveCompleted(move) {
        // Apply clock increment to the player who just moved
        if (this.timerConfig.enabled && this.engine.history.length > 2) {
            const justMovedColor = Chess.oppositeColor(this.engine.activeColor);
            this.timers[justMovedColor] += this.timerConfig.incrementSeconds;
            this.updateTimerDisplay();
        }

        // Sync visual UI elements
        this.syncGameUi();

        const gameState = this.engine.getGameState();

        if (gameState === Chess.PLAYING || gameState === Chess.CHECK) {
            // Restart Timer
            this.startTimer();

            // Auto-flip if enabled (slight delay to let user see piece land)
            if (this.dom.autoFlipSelect.value === 'yes') {
                setTimeout(() => {
                    const expectedFlip = (this.engine.activeColor === Chess.BLACK);
                    if (this.board.isFlipped !== expectedFlip) {
                        this.board.flip();
                    }
                }, 500);
            }
        } else {
            // Game Over
            this.stopTimer();
            this.board.playSound('game-over');

            let title = 'Game Over';
            let reason = '';

            switch (gameState) {
                case Chess.CHECKMATE:
                    const winner = (this.engine.activeColor === Chess.WHITE) ? 'Black' : 'White';
                    title = `${winner} Wins!`;
                    reason = 'By checkmate.';
                    break;
                case Chess.STALEMATE:
                    title = 'Draw';
                    reason = 'By stalemate.';
                    break;
                case Chess.DRAW_INSUFFICIENT:
                    title = 'Draw';
                    reason = 'By insufficient material.';
                    break;
                case Chess.DRAW_FIFTY_MOVE:
                    title = 'Draw';
                    reason = 'By fifty-move rule.';
                    break;
                case Chess.DRAW_THREEFOLD:
                    title = 'Draw';
                    reason = 'By threefold repetition.';
                    break;
            }

            this.showGameOverModal(title, reason);
        }
    }

    /**
     * Prompts the user with a confirmation overlay and returns a Promise resolving to true/false.
     */
    showConfirmModal(title, reason) {
        return new Promise((resolve) => {
            this.dom.confirmTitle.textContent = title;
            this.dom.confirmReason.textContent = reason;
            this.dom.confirmOverlay.classList.remove('hidden');

            const cleanup = (value) => {
                this.dom.confirmOverlay.classList.add('hidden');
                this.dom.confirmYesBtn.removeEventListener('click', onYes);
                this.dom.confirmNoBtn.removeEventListener('click', onNo);
                resolve(value);
            };

            const onYes = () => cleanup(true);
            const onNo = () => cleanup(false);

            this.dom.confirmYesBtn.addEventListener('click', onYes);
            this.dom.confirmNoBtn.addEventListener('click', onNo);
        });
    }

    /**
     * Handles offering a draw.
     */
    async promptDrawOffer() {
        const activeColorStr = (this.engine.activeColor === Chess.WHITE) ? 'White' : 'Black';
        const opposingColorStr = (this.engine.activeColor === Chess.WHITE) ? 'Black' : 'White';
        
        const accepted = await this.showConfirmModal(
            'Draw Offered',
            `${activeColorStr} offers a draw. Does ${opposingColorStr} accept?`
        );
        
        if (accepted) {
            this.stopTimer();
            this.board.playSound('game-over');
            this.showGameOverModal('Draw', 'By agreement.');
        }
    }

    /**
     * Handles resignation.
     */
    async promptResignation() {
        const activeColorStr = (this.engine.activeColor === Chess.WHITE) ? 'White' : 'Black';
        const winnerStr = (this.engine.activeColor === Chess.WHITE) ? 'Black' : 'White';
        
        const confirmed = await this.showConfirmModal(
            'Resign Match?',
            `Are you sure you want to resign as ${activeColorStr}?`
        );
        
        if (confirmed) {
            this.stopTimer();
            this.board.playSound('game-over');
            this.showGameOverModal(`${winnerStr} Wins!`, `${activeColorStr} resigned.`);
        }
    }

    /**
     * Syncs captures, active move log tables, text fields.
     */
    syncGameUi() {
        // Update Turn indicators
        const activeColorStr = (this.engine.activeColor === Chess.WHITE) ? 'White' : 'Black';
        this.dom.turnIndicator.textContent = `${activeColorStr}'s Turn`;

        const state = this.engine.getGameState();
        if (state === Chess.CHECK) {
            this.dom.gameStateIndicator.textContent = 'Check!';
            this.dom.gameStateIndicator.classList.add('alert-check');
        } else {
            this.dom.gameStateIndicator.textContent = '';
            this.dom.gameStateIndicator.classList.remove('alert-check');
        }

        // Render Capture Panels
        this.renderCapturedPieces();

        // Render Move logs
        this.renderMoveLog();

        // Sync FEN output box
        this.dom.fenInput.value = this.engine.generateFen();
    }

    renderCapturedPieces() {
        // Count starting pieces vs current board to identify missing pieces
        const counts = {
            [Chess.WHITE]: { [Chess.PAWN]: 8, [Chess.KNIGHT]: 2, [Chess.BISHOP]: 2, [Chess.ROOK]: 2, [Chess.QUEEN]: 1 },
            [Chess.BLACK]: { [Chess.PAWN]: 8, [Chess.KNIGHT]: 2, [Chess.BISHOP]: 2, [Chess.ROOK]: 2, [Chess.QUEEN]: 1 }
        };

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const p = this.engine.board[r][f];
                if (p && p.type !== Chess.KING) {
                    counts[p.color][p.type]--;
                }
            }
        }

        const renderCapturedSide = (container, countObj, color) => {
            container.innerHTML = '';
            
            // Map types to short FEN char for CSS classes and ordering
            const types = [Chess.QUEEN, Chess.ROOK, Chess.BISHOP, Chess.KNIGHT, Chess.PAWN];
            let scoreDiff = 0; // Capture score differences (like Lichess +3 indicator)

            types.forEach(t => {
                const missing = countObj[t];
                if (missing > 0) {
                    for (let i = 0; i < missing; i++) {
                        const icon = document.createElement('span');
                        icon.classList.add('captured-icon');
                        icon.innerHTML = Chess.getPieceSvgHtml(t, color);
                        container.appendChild(icon);
                    }
                }
            });
        };

        // Render white pieces captured (rendered in Black's panel)
        renderCapturedSide(this.dom.capturedWhiteContainer, counts[Chess.WHITE], Chess.WHITE);
        // Render black pieces captured (rendered in White's panel)
        renderCapturedSide(this.dom.capturedBlackContainer, counts[Chess.BLACK], Chess.BLACK);
    }

    renderMoveLog() {
        this.dom.moveLogBody.innerHTML = '';

        // Walk through history elements to form pairs: (WhiteMove, BlackMove)
        // History index 0 is initial state, 1 is white first move, 2 is black first move
        let movePairs = [];
        for (let i = 1; i < this.engine.history.length; i += 2) {
            const wState = this.engine.history[i];
            const bState = this.engine.history[i + 1] || null;

            // Generate SAN text values retrospectively
            // Revert state momentarily to render matching SAN
            const prevEngine = new ChessEngine();
            // Re-apply movements to compute correct disambiguation symbols
            for (let j = 1; j < i; j++) {
                prevEngine.makeMove(this.engine.history[j].move);
            }
            const wSan = prevEngine.moveToSan(wState.move);

            let bSan = '';
            if (bState) {
                prevEngine.makeMove(wState.move);
                bSan = prevEngine.moveToSan(bState.move);
            }

            movePairs.push({
                num: Math.floor(i / 2) + 1,
                wSan,
                bSan
            });
        }

        movePairs.forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="log-num">${p.num}.</td>
                <td class="log-san">${p.wSan}</td>
                <td class="log-san">${p.bSan}</td>
            `;
            this.dom.moveLogBody.appendChild(row);
        });

        // Scroll to bottom of log automatically
        const logWrapper = this.dom.moveLogBody.parentElement.parentElement;
        logWrapper.scrollTop = logWrapper.scrollHeight;
    }

    showGameOverModal(title, reason) {
        this.dom.gameOverTitle.textContent = title;
        this.dom.gameOverReason.textContent = reason;
        this.dom.gameOverOverlay.classList.remove('hidden');
    }

    /**
     * Parses standard PGN file format and imports state sequence.
     */
    loadPgn(pgn) {
        try {
            // Split PGN to parse header tags vs movements
            // Clean comments, line breaks, double spaces, results markers
            const cleanPgn = pgn
                .replace(/\[.*?\]/g, '') // remove headers
                .replace(/\{.*?\}/g, '') // remove comments
                .replace(/\d+\./g, '') // remove move numbering
                .replace(/\s+/g, ' ') // collapse whitespaces
                .trim();

            const moveTokens = cleanPgn.split(' ').filter(token => {
                // Ignore empty or game results: 1-0, 0-1, 1/2-1/2, *
                return token && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token);
            });

            this.engine.reset();
            this.board.deselect();

            for (const token of moveTokens) {
                const move = this.engine.parseSan(token);
                if (!move) {
                    throw new Error(`Unable to parse PGN token: '${token}'`);
                }
                this.engine.makeMove(move);
            }

            this.board.draw();
            this.syncGameUi();
            this.resetTimerState();
            alert("PGN moves imported successfully!");
        } catch (err) {
            alert("Failed to load PGN: " + err.message);
        }
    }
}

// Instantiate App when Document loads
window.addEventListener('DOMContentLoaded', () => {
    window.app = new ChessApp();
});
