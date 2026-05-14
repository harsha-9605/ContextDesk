import pytest
from ai.engine import SemanticEngine

@pytest.fixture
def engine():
    """Fixture to initialize the SemanticEngine for tests."""
    return SemanticEngine()

def test_generate_embedding_length(engine):
    """Test that the generated embedding has the correct dimension (384)."""
    text = "I love learning about Artificial Intelligence at LPU."
    vector = engine.generate_embedding(text)
    
    # In pytest, we use 'assert' to check if something is true.
    # If the assertion fails, the test fails automatically.
    assert len(vector) == 384, f"Expected vector length 384, but got {len(vector)}"

def test_generate_embedding_type(engine):
    """Test that the generated embedding contains floats."""
    text = "Just a simple test string."
    vector = engine.generate_embedding(text)
    
    assert isinstance(vector, list), "Embedding should be a list"
    if len(vector) > 0:
        assert isinstance(vector[0], float), "Embedding values should be floats"
