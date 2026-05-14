import os
import pytest
from ai.engine import SemanticEngine

@pytest.fixture
def engine():
    """Fixture to initialize the SemanticEngine for tests."""
    return SemanticEngine()

@pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="Requires HF_TOKEN environment variable")
def test_generate_embedding_length(engine):
    """Test that the generated embedding has the correct dimension (384)."""
    text = "I love learning about Artificial Intelligence at LPU."
    vector = engine.generate_embedding(text)
    
    assert len(vector) == 384, f"Expected vector length 384, but got {len(vector)}"

@pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="Requires HF_TOKEN environment variable")
def test_generate_embedding_type(engine):
    """Test that the generated embedding contains floats."""
    text = "Just a simple test string."
    vector = engine.generate_embedding(text)
    
    assert isinstance(vector, list), "Embedding should be a list"
    if len(vector) > 0:
        assert isinstance(vector[0], float), "Embedding values should be floats"
