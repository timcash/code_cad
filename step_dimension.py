import cadquery as cq

# Load the STEP file
result = cq.importers.importStep("test.step")

# Get all solids from the imported shape
all_solids = result.solids().objects

print(f"Found {len(all_solids)} solid(s).")
print("-" * 20)

# Iterate through each solid and print its dimensions
for i, solid in enumerate(all_solids):
    # Get the bounding box of the solid
    bb = solid.BoundingBox()
    
    # Print the dimensions
    print(f"Solid {i+1}:")
    print(f"  Length (X): {bb.xlen:.2f}")
    print(f"  Width  (Y): {bb.ylen:.2f}")
    print(f"  Height (Z): {bb.zlen:.2f}")
    print("-" * 20)

# Get the bounding box of the entire part
total_bb = result.val().BoundingBox()

# Print the total dimensions
print("Total Dimensions of the Entire Part:")
print(f"  Length (X): {total_bb.xlen:.2f}")
print(f"  Width  (Y): {total_bb.ylen:.2f}")
print(f"  Height (Z): {total_bb.zlen:.2f}")
print("-" * 20)
