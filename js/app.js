/**
 * app.js — Main Application Orchestrator
 * 
 * Sets up game state, timers, AI players, game logs,
 * import/export features, and updates user interface panels.
 */

'use strict';

const Chess = window.Chess || {};

class ChessApp {
    constructor() {
        this.engine = new ChessEngine();
        this.ai = new ChessAI();

        // Game Configuration
        this.gameMode = 'pvp'; // 'pvp' or 'pve'
        this.aiDifficulty = 'medium';
        this.playerColor = Chess.WHITE; // White by default in PvE

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
            gameModeSelect: document.getElementById('game-mode'),
            difficultySelect: document.getElementById('ai-difficulty'),
            difficultyGroup: document.getElementById('difficulty-group'),
            playerColorSelect: document.getElementById('player-color'),
            colorGroup: document.getElementById('color-group'),
            timerSelect: document.getElementById('timer-setting'),
            
            // Buttons
            restartBtn: document.getElementById('btn-restart'),
            undoBtn: document.getElementById('btn-undo'),
            flipBtn: document.getElementById('btn-flip'),
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
            
            // Clipboard text areas
            fenInput: document.getElementById('fen-io-box'),
            pgnInput: document.getElementById('pgn-io-box')
        };

        // Initialize Board Component
        this.board = new ChessBoard(this.dom.boardContainer, this.engine, {
            onMove: (move) => this.handleMoveCompleted(move)
        });

        this.setupEventListeners();
        this.resetGame();
    }

    setupEventListeners() {
        // Mode change handlers
        this.dom.gameModeSelect.addEventListener('change', (e) => {
            this.gameMode = e.target.value;
            const isPve = (this.gameMode === 'pve');
            this.dom.difficultyGroup.classList.toggle('hidden', !isPve);
            this.dom.colorGroup.classList.toggle('hidden', !isPve);
            this.resetGame();
        });

        this.dom.difficultySelect.addEventListener('change', (e) => {
            this.aiDifficulty = e.target.value;
        });

        this.dom.playerColorSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            this.playerColor = (val === 'white') ? Chess.WHITE : (val === 'black') ? Chess.BLACK : 'random';
            this.resetGame();
        });

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

        // Button Click handlers
        this.dom.restartBtn.addEventListener('click', () => this.resetGame());
        this.dom.gameOverRestartBtn.addEventListener('click', () => {
            this.dom.gameOverOverlay.classList.add('hidden');
            this.resetGame();
        });

        this.dom.undoBtn.addEventListener('click', () => this.handleUndo());
        this.dom.flipBtn.addEventListener('click', () => this.board.flip());

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

    /**
     * Resets the board, engine state, timers, and active panels.
     */
    resetGame() {
        this.stopTimer();

        // 1. Determine actual color if randomized
        let assignedColor = this.playerColor;
        if (this.playerColor === 'random') {
            assignedColor = Math.random() < 0.5 ? Chess.WHITE : Chess.BLACK;
        }
        this.activePlayerColor = assignedColor;

        // 2. Adjust board flip state based on assigned color
        // If Black, flip the board automatically so they play from bottom
        if (this.gameMode === 'pve' && this.activePlayerColor === Chess.BLACK) {
            if (!this.board.isFlipped) this.board.flip();
        } else {
            if (this.board.isFlipped) this.board.flip();
        }

        // 3. Reset Engine
        this.engine.reset();
        this.board.deselect();
        this.board.draw();

        // 4. Reset Clocks
        this.resetTimerState();

        // 5. Update Panels
        this.syncGameUi();

        // 6. If PVE and player is Black, trigger initial AI Move
        if (this.gameMode === 'pve' && this.activePlayerColor === Chess.BLACK) {
            this.triggerAiMove();
        }
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

        if (this.gameMode === 'pve') {
            // Revert twice so player gets their turn back (AI move + Player move)
            this.engine.undoMove();
            this.engine.undoMove();
        } else {
            this.engine.undoMove();
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

            // Handle AI move trigger
            if (this.gameMode === 'pve' && this.engine.activeColor !== this.activePlayerColor) {
                this.triggerAiMove();
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
     * Executes async AI search and executes choice.
     */
    async triggerAiMove() {
        // Add visual loading state to UI
        this.dom.gameStateIndicator.innerHTML = '<span class="pulse">AI is thinking...</span>';
        this.dom.gameStateIndicator.classList.add('active');

        const move = await this.ai.getBestMoveAsync(this.engine, this.aiDifficulty);

        if (move) {
            const isCapture = (move.captured !== null);
            const isCastle = (move.flags === 'c');

            this.engine.makeMove(move);
            this.board.deselect();
            this.board.draw();

            // Play synthesized sound
            if (this.engine.isInCheck(this.engine.activeColor)) {
                this.board.playSound('check');
            } else if (isCapture) {
                this.board.playSound('capture');
            } else if (isCastle) {
                this.board.playSound('castle');
            } else {
                this.board.playSound('move');
            }

            this.handleMoveCompleted(move);
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
