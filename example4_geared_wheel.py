import cadquery as cq
import cadquery.vis as vis
import math

# Create a geared wheel with mounting holes
# This example demonstrates intermediate CadQuery features:
# - Multiple workplanes and operations
# - Circular patterns
# - Complex boolean operations
# - Practical geometry

# Parameters
outer_diameter = 80.0
inner_diameter = 20.0
thickness = 8.0
tooth_height = 6.0
tooth_width = 4.0
num_teeth = 20
mounting_hole_diameter = 6.0
num_mounting_holes = 4
mounting_hole_radius = 25.0

try:
    # Create the main wheel body
    wheel = cq.Workplane("XY").cylinder(thickness, outer_diameter/2)
    print("✓ Created wheel body")

    # Create the inner hole
    wheel = wheel.faces(">Z").workplane().hole(inner_diameter)
    print("✓ Created center hole")

    # Create teeth using circular pattern
    # Start with a single tooth
    tooth = (cq.Workplane("XY")
             .moveTo(outer_diameter/2 - tooth_height, 0)
             .lineTo(outer_diameter/2, tooth_width/2)
             .lineTo(outer_diameter/2, -tooth_width/2)
             .close()
             .extrude(thickness))
    print("✓ Created tooth profile")

    # Create circular pattern of teeth
    teeth = cq.Workplane("XY")
    for i in range(num_teeth):
        angle = i * 360.0 / num_teeth
        rotated_tooth = tooth.rotate((0, 0, 0), (0, 0, 1), angle)
        teeth = teeth.union(rotated_tooth)
    print(f"✓ Created {num_teeth} teeth in circular pattern")

    # Combine wheel body with teeth
    result = wheel.union(teeth)
    print("✓ Combined wheel with teeth")

    # Create mounting holes using circular pattern
    # Create a single hole first, then pattern it
    base_hole = (cq.Workplane("XY")
                 .moveTo(mounting_hole_radius, 0)
                 .cylinder(thickness, mounting_hole_diameter/2))

    mounting_holes = cq.Workplane("XY")
    for i in range(num_mounting_holes):
        angle = i * 360.0 / num_mounting_holes
        rotated_hole = base_hole.rotate((0, 0, 0), (0, 0, 1), angle)
        mounting_holes = mounting_holes.union(rotated_hole)
    print(f"✓ Created {num_mounting_holes} mounting holes")

    # Subtract mounting holes from the wheel
    result = result.cut(mounting_holes)
    print("✓ Cut mounting holes from wheel")

    # Note: Filleting removed due to complexity - can be added later
    # result = result.edges("|Z").fillet(1.0)

    # Display the result
    print("✓ Displaying 3D model...")
    vis.show_object(result)

    print("\n🎉 Geared wheel created successfully!")
    print(f"📏 Outer diameter: {outer_diameter}mm")
    print(f"🔘 Inner diameter: {inner_diameter}mm")
    print(f"📐 Thickness: {thickness}mm")
    print(f"⚙️  Number of teeth: {num_teeth}")
    print(f"🔩 Number of mounting holes: {num_mounting_holes}")

except Exception as e:
    print(f"❌ Error creating geared wheel: {e}")
    print("This might be due to CadQuery version compatibility or geometry issues.")
