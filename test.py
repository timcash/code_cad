import cadquery as cq

# Import the STEP file
result = cq.importers.importStep("test.step")

# Access the solids in the imported shape
solids = result.solids().objects

print(f"Found {len(solids)} solid(s)")

for i, solid in enumerate(solids):
    print(f"  Solid {i+1}:")
    
    # Access the faces of each solid
    faces = solid.Faces()
    print(f"    Found {len(faces)} face(s)")
    
    # Access the edges of each solid
    edges = solid.Edges()
    print(f"    Found {len(edges)} edge(s)")
    
    # Access the vertices of each solid
    vertices = solid.Vertices()
    print(f"    Found {len(vertices)} vertex(s)")