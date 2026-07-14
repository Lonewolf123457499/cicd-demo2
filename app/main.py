import random
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

app = FastAPI(
    title="DevOps Tic-Tac-Toe API",
    description="A simple Tic-Tac-Toe backend server with an AI opponent.",
    version="1.0.0"
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# Request and Response Schemas
class MoveRequest(BaseModel):
    board: List[str] = Field(..., min_length=9, max_length=9, description="Current board state (9 elements, empty string, 'X', or 'O')")
    ai_symbol: str = Field("O", description="The symbol the AI is playing as ('X' or 'O')")
    player_symbol: str = Field("X", description="The symbol the player is playing as ('X' or 'O')")
    difficulty: str = Field("hard", description="Difficulty level: 'easy', 'medium', or 'hard'")

class MoveResponse(BaseModel):
    index: Optional[int] = Field(None, description="Index of the AI's move (0-8), or null if the game is over")
    winner: Optional[str] = Field(None, description="Winner if the game has ended ('X', 'O', 'draw', or null)")

# Helper logic to check winning states
WIN_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],  # Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8],  # Columns
    [0, 4, 8], [2, 4, 6]              # Diagonals
]

def check_winner(board: List[str]) -> Optional[str]:
    for combo in WIN_COMBINATIONS:
        if board[combo[0]] == board[combo[1]] == board[combo[2]] != "":
            return board[combo[0]]
    if "" not in board:
        return "draw"
    return None

def minimax(board: List[str], depth: int, is_maximizing: bool, ai_symbol: str, player_symbol: str) -> int:
    winner = check_winner(board)
    if winner == ai_symbol:
        return 10 - depth
    if winner == player_symbol:
        return depth - 10
    if winner == "draw":
        return 0

    if is_maximizing:
        best_score = -float('inf')
        for i in range(9):
            if board[i] == "":
                board[i] = ai_symbol
                score = minimax(board, depth + 1, False, ai_symbol, player_symbol)
                board[i] = ""
                best_score = max(score, best_score)
        return best_score
    else:
        best_score = float('inf')
        for i in range(9):
            if board[i] == "":
                board[i] = player_symbol
                score = minimax(board, depth + 1, True, ai_symbol, player_symbol)
                board[i] = ""
                best_score = min(score, best_score)
        return best_score

def get_best_move(board: List[str], ai_symbol: str, player_symbol: str) -> Optional[int]:
    best_score = -float('inf')
    best_move = None
    
    # Check if AI can win in the next move, or block opponent from winning (heuristics before full search for efficiency)
    for i in range(9):
        if board[i] == "":
            board[i] = ai_symbol
            if check_winner(board) == ai_symbol:
                board[i] = ""
                return i
            board[i] = ""
            
    for i in range(9):
        if board[i] == "":
            board[i] = player_symbol
            if check_winner(board) == player_symbol:
                board[i] = ""
                return i
            board[i] = ""

    # Otherwise, run full minimax
    for i in range(9):
        if board[i] == "":
            board[i] = ai_symbol
            score = minimax(board, 0, False, ai_symbol, player_symbol)
            board[i] = ""
            if score > best_score:
                best_score = score
                best_move = i
    return best_move

@app.get("/api/health")
def health_check():
    """Health check endpoint for DevOps monitoring and Kubernetes probes."""
    return {"status": "healthy", "version": "1.0.0"}

@app.post("/api/next-move", response_model=MoveResponse)
def get_next_move(req: MoveRequest):
    """Calculates the AI's next move based on current board state and difficulty."""
    board = list(req.board)
    ai = req.ai_symbol
    player = req.player_symbol
    
    # Check if game is already over
    winner = check_winner(board)
    if winner is not None:
        return MoveResponse(index=None, winner=winner)
        
    # Find available spots
    available_indices = [i for i, val in enumerate(board) if val == ""]
    if not available_indices:
        return MoveResponse(index=None, winner="draw")
        
    # Decide move based on difficulty
    selected_move = None
    difficulty = req.difficulty.lower()
    
    if difficulty == "easy":
        # Random move
        selected_move = random.choice(available_indices)
    elif difficulty == "medium":
        # 50% chance of best move, 50% chance of random move
        if random.random() < 0.5:
            selected_move = get_best_move(board, ai, player)
        else:
            selected_move = random.choice(available_indices)
    else:  # 'hard' mode
        selected_move = get_best_move(board, ai, player)
        
    # Double check we got a move, fallback if necessary
    if selected_move is None or board[selected_move] != "":
        selected_move = random.choice(available_indices)
        
    # Apply the move to see what the state will be after the move
    board[selected_move] = ai
    post_move_winner = check_winner(board)
    
    return MoveResponse(index=selected_move, winner=post_move_winner)

# Mount the static files directory. Static files must be served *after* API routes.
# Ensure the directory exists.
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def get_index():
    """Serve the main index.html file."""
    return FileResponse(STATIC_DIR / "index.html")
