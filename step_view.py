import cadquery as cq
from cadquery.vis import show
from cadquery import exporters

# Load the STEP file
result = cq.importers.importStep("test.step")

# Get all solids from the imported shape
all_solids = result.solids().objects

print(f"Found {len(all_solids)} solids in the original object.")

# Keep solids starting from the 6th one (index 5)
if len(all_solids) > 8:
    remaining_solids = all_solids[13:]
    print(f"Keeping {len(remaining_solids)} solids after removing the first 5.")
    
    if remaining_solids:
        # Create a new compound shape from the remaining solids
        remaining_shape = cq.Compound.makeCompound(remaining_solids)
        
        # Show the resulting shape
        print("Showing the object with the first 5 solids removed.")
        show(remaining_shape, width=800, height=800, screenshot='img.png', zoom=2, roll=-20, elevation=-30, interact=False)
    else:
        print("No solids remaining after removal.")
else:
    print("Fewer than 6 solids found, so none were removed.")
    # Show the original object if there are 5 or fewer solids
    show(result, width=800, height=800, screenshot='img.png', zoom=2, roll=-20, elevation=-30, interact=False)