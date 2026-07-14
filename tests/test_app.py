from fastapi.testclient import TestClient

from app.main import app, check_winner, get_best_move


client = TestClient(app)


def test_check_winner_detects_horizontal_win():
    board = ["X", "X", "X", "O", "", "", "", "", ""]
    assert check_winner(board) == "X"


def test_check_winner_detects_draw():
    board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"]
    assert check_winner(board) == "draw"


def test_get_best_move_blocks_immediate_loss():
    board = ["X", "X", "", "", "", "", "", "", ""]
    assert get_best_move(board, ai_symbol="O", player_symbol="X") == 2


def test_health_endpoint_returns_expected_payload():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "version": "1.0.0"}


def test_next_move_endpoint_returns_blocking_move_for_hard_mode():
    response = client.post(
        "/api/next-move",
        json={
            "board": ["X", "X", "", "", "", "", "", "", ""],
            "ai_symbol": "O",
            "player_symbol": "X",
            "difficulty": "hard",
        },
    )

    assert response.status_code == 200
    assert response.json()["index"] == 2
    assert response.json()["winner"] is None
