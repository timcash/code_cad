import cadquery as cq
import cadquery.vis as vis
# Create a box and shell it to make a thin-walled box.
result = cq.Workplane("XY").box(10, 10, 10).faces(">Z").shell(1.0)

# Display the result
vis.show_object(result)

