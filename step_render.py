import cadquery as cq
from cadquery import exporters

# Load the STEP file
result = cq.importers.importStep("test.step")

exporters.export(result, 'test2.svg')
