// Game State Variables
let board = Array(9).fill("");
let isGameActive = true;
let currentTurn = "X"; // Player is always X, AI/Player 2 is O
let opponentType = "ai"; // 'ai' or 'local'
let difficulty = "hard"; // 'easy', 'medium', or 'hard'

// Score tracking
let scores = {
    x: 0,
    o: 0,
    ties: 0
};

// Winning lines constant
const WIN_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// DOM Elements
const cells = document.querySelectorAll(".cell");
const statusBar = document.getElementById("status-bar");
const statusText = document.getElementById("status-text");
const thinkingIndicator = document.getElementById("thinking-indicator");
const restartBtn = document.getElementById("restart-btn");
const modalRestartBtn = document.getElementById("modal-restart-btn");
const resetScoresBtn = document.getElementById("reset-scores-btn");
const opponentSelector = document.getElementById("opponent-type");
const difficultySelector = document.getElementById("difficulty");
const difficultyGroup = document.getElementById("difficulty-group");
const healthDot = document.getElementById("health-dot");
const healthText = document.getElementById("health-text");
const celebrationOverlay = document.getElementById("celebration-overlay");
const winnerTitle = document.getElementById("winner-title");
const winnerSubtitle = document.getElementById("winner-subtitle");
const oLabel = document.getElementById("o-label");

// Score DOM Elements
const scoreXElement = document.getElementById("score-x");
const scoreOElement = document.getElementById("score-o");
const scoreTiesElement = document.getElementById("score-ties");

// Initialize Game
document.addEventListener("DOMContentLoaded", () => {
    loadScores();
    setupEventListeners();
    checkApiHealth();
});

// Setup Listeners
function setupEventListeners() {
    // Board cells
    cells.forEach(cell => {
        cell.addEventListener("click", () => handleCellClick(cell));
    });

    // Control buttons
    restartBtn.addEventListener("click", () => resetGame());
    modalRestartBtn.addEventListener("click", () => {
        closeCelebration();
        resetGame();
    });
    resetScoresBtn.addEventListener("click", () => resetScores());

    // Game mode toggle
    opponentSelector.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            opponentSelector.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
            e.target.classList.add("active");
            opponentType = e.target.dataset.value;
            
            if (opponentType === "ai") {
                difficultyGroup.style.display = "flex";
                oLabel.textContent = "AI (O)";
            } else {
                difficultyGroup.style.display = "none";
                oLabel.textContent = "Player (O)";
            }
            resetGame();
        }
    });

    // Difficulty selection toggle
    difficultySelector.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
            difficultySelector.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
            e.target.classList.add("active");
            difficulty = e.target.dataset.value;
        }
    });
}

// Check Backend API Health
async function checkApiHealth() {
    try {
        const response = await fetch("/api/health");
        if (response.ok) {
            const data = await response.json();
            healthDot.className = "status-dot healthy";
            healthText.textContent = `API: Healthy v${data.version}`;
        } else {
            throw new Error("API not returning OK");
        }
    } catch (error) {
        healthDot.className = "status-dot pulsing";
        healthText.textContent = "API: Offline (Local Mode Enabled)";
        // Force opponent type to local if api is offline
        forceLocalMode();
    }
}

function forceLocalMode() {
    opponentType = "local";
    opponentSelector.querySelectorAll("button").forEach(btn => {
        if (btn.dataset.value === "local") btn.classList.add("active");
        else btn.classList.remove("active");
    });
    difficultyGroup.style.display = "none";
    oLabel.textContent = "Player (O)";
}

// Handle Board Cell Clicks
async function handleCellClick(cell) {
    const index = parseInt(cell.dataset.index);

    // If cell is already taken or game is over, or AI is thinking
    if (board[index] !== "" || !isGameActive || (opponentType === "ai" && currentTurn === "O")) {
        return;
    }

    // Process player move
    makeMove(index, currentTurn);

    // Check for win/draw
    const result = checkGameStatus();
    if (result) {
        endGame(result);
        return;
    }

    // Switch turns
    currentTurn = currentTurn === "X" ? "O" : "X";
    updateStatusBar();

    // Trigger AI move if in AI mode
    if (opponentType === "ai" && isGameActive && currentTurn === "O") {
        await triggerAiMove();
    }
}

// Draw X or O onto the board and record in state
function makeMove(index, player) {
    board[index] = player;
    const cell = cells[index];
    cell.classList.add(player.toLowerCase());
}

// Main logic to determine next step from FastAPI AI
async function triggerAiMove() {
    showThinking(true);
    
    try {
        const response = await fetch("/api/next-move", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                board: board,
                ai_symbol: "O",
                player_symbol: "X",
                difficulty: difficulty
            })
        });

        if (!response.ok) {
            throw new Error("Failed to contact game backend");
        }

        const data = await response.json();
        
        // Wait a small organic delay (e.g. 500ms) to feel natural
        await new Promise(resolve => setTimeout(resolve, 400));
        
        if (data.index !== null && board[data.index] === "") {
            makeMove(data.index, "O");
            
            // Check status using backend-calculated outcome or verify client-side
            const result = checkGameStatus();
            if (result) {
                endGame(result);
                return;
            }
            
            currentTurn = "X";
            updateStatusBar();
        }
    } catch (error) {
        console.error("Error fetching next move:", error);
        // Fallback to a client-side random move if API fails during play
        statusBar.style.borderColor = "rgba(239, 68, 68, 0.3)";
        statusText.textContent = "AI Error - executing backup move...";
        await new Promise(resolve => setTimeout(resolve, 800));
        
        makeLocalAiFallbackMove();
    } finally {
        showThinking(false);
    }
}

// Backup AI in case of local offline play or server failures
function makeLocalAiFallbackMove() {
    const emptyCells = board.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
    if (emptyCells.length > 0) {
        const randomIdx = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        makeMove(randomIdx, "O");
        
        const result = checkGameStatus();
        if (result) {
            endGame(result);
            return;
        }
        currentTurn = "X";
        updateStatusBar();
    }
}

// Visual indicator for AI computation
function showThinking(isThinking) {
    if (isThinking) {
        thinkingIndicator.style.display = "block";
        statusText.textContent = "AI is thinking...";
    } else {
        thinkingIndicator.style.display = "none";
    }
}

// Status text updates
function updateStatusBar() {
    if (opponentType === "local") {
        statusText.textContent = `Player ${currentTurn}'s Turn`;
    } else {
        statusText.textContent = currentTurn === "X" ? "Your turn (X)" : "AI's Turn (O)";
    }
}

// Analyze board for game endings
function checkGameStatus() {
    // Check win combos
    for (const combo of WIN_COMBINATIONS) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            // Highlight cells
            cells[a].classList.add("winner-cell");
            cells[b].classList.add("winner-cell");
            cells[c].classList.add("winner-cell");
            return { winner: board[a], combination: combo };
        }
    }
    
    // Check tie
    if (!board.includes("")) {
        return { winner: "draw" };
    }
    
    return null; // Game continues
}

// End of game actions
function endGame(result) {
    isGameActive = false;
    
    setTimeout(() => {
        if (result.winner === "draw") {
            scores.ties++;
            winnerTitle.textContent = "It's a Draw!";
            winnerSubtitle.textContent = "The grid is locked. Perfect defense!";
        } else {
            if (result.winner === "X") {
                scores.x++;
                winnerTitle.textContent = "Victory!";
                winnerSubtitle.textContent = opponentType === "ai" 
                    ? "You defeated the FastAPI backend engine!" 
                    : "Player X won the match!";
            } else {
                scores.o++;
                winnerTitle.textContent = opponentType === "ai" ? "Defeat!" : "Victory!";
                winnerSubtitle.textContent = opponentType === "ai" 
                    ? "The FastAPI minimax engine calculated your demise." 
                    : "Player O won the match!";
            }
        }
        
        saveScores();
        updateScoreboardDisplay();
        openCelebration();
    }, 600);
}

// Overlay displays
function openCelebration() {
    celebrationOverlay.classList.add("show");
}

function closeCelebration() {
    celebrationOverlay.classList.remove("show");
}

// Reset functions
function resetGame() {
    board = Array(9).fill("");
    isGameActive = true;
    currentTurn = "X";
    
    cells.forEach(cell => {
        cell.className = "cell"; // removes 'x', 'o', 'winner-cell'
    });
    
    statusBar.style.borderColor = "";
    updateStatusBar();
    showThinking(false);
}

function resetScores() {
    scores = { x: 0, o: 0, ties: 0 };
    saveScores();
    updateScoreboardDisplay();
}

// Scoreboard Storage & display
function saveScores() {
    localStorage.setItem("tictactoe-devops-scores", JSON.stringify(scores));
}

function loadScores() {
    const storedScores = localStorage.getItem("tictactoe-devops-scores");
    if (storedScores) {
        try {
            scores = JSON.parse(storedScores);
        } catch (e) {
            console.error("Error loading scores:", e);
        }
    }
    updateScoreboardDisplay();
}

function updateScoreboardDisplay() {
    scoreXElement.textContent = scores.x;
    scoreOElement.textContent = scores.o;
    scoreTiesElement.textContent = scores.ties;
}
