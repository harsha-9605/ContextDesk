from ai.engine import SemanticEngine

# Initialize the brain
engine = SemanticEngine()

# Test with a simple string
text = "I love learning about Artificial Intelligence at LPU."
vector = engine.generate_embedding(text)

print(f"Vector Length: {len(vector)}") # Should be 384
print(f"First 5 numbers: {vector[:5]}")
