import cadquery as cq
import cadquery.vis as vis
# Create a plate with a hole in the center.
result = cq.Workplane("XY").box(10, 10, 1).faces(">Z").workplane().hole(5)

# Display the result
vis.show_object(result)
