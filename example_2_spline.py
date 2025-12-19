import cadquery as cq
import cadquery.vis as vis

# Create a shape with a spline edge.
s = cq.Workplane("XY")
s = s.moveTo(10, 0)
s = s.lineTo(10, 10)
s = s.lineTo(0, 10)
s = s.spline([(5, 5), (10, 0)], tangents=[(1, 0), (1, 0)], includeCurrent=True)
s = s.close()
result = s.extrude(1)

# Display the result
vis.show_object(result)

