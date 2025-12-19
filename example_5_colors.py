from cadquery import *
from cadquery.vis import show

# Create three simple parts with different colors
# Part 1: A red box
red_box = Workplane().box(10, 10, 10)

# Part 2: A blue cylinder
blue_cylinder = Workplane().cylinder(radius=5, height=15)

# Part 3: A green sphere
green_sphere = Workplane().sphere(radius=6)

# Create an assembly starting with the red box
assy = Assembly(red_box, name="red_box", color=Color(1, 0, 0, 1))  # Red with full opacity

# Add the blue cylinder at a specific location
assy = assy.add(
    blue_cylinder, 
    loc=Location(Vector(20, 0, 0)),  # Position to the right of the box
    name="blue_cylinder", 
    color=Color(0, 0, 1, 1)  # Blue with full opacity
)

# Add the green sphere at another location
assy = assy.add(
    green_sphere, 
    loc=Location(Vector(0, 20, 0)),  # Position above the box
    name="green_sphere", 
    color=Color(0, 1, 0, 1)  # Green with full opacity
)

# Display the assembly (optional - for interactive environments)
show(assy)

# Save the assembly to a STEP file
# assy.save("colored_assembly.step")

print("Assembly created with 3 colored parts:")
print("- Red box at origin")
print("- Blue cylinder at (20, 0, 0)")
print("- Green sphere at (0, 20, 0)")
print("Assembly saved as 'colored_assembly.step'")
