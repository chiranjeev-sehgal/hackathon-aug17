from app.config import COST_PER_1K_TOKENS


def calculate_cost(total_tokens: int) -> float:
    return round((total_tokens / 1000.0) * COST_PER_1K_TOKENS, 6)
