import cadquery as cq
import math
import tempfile
import os
from .log_client import logger

def generate_gear(
    outer_diameter: float = 80.0,
    inner_diameter: float = 20.0,
    thickness: float = 8.0,
    tooth_height: float = 6.0,
    tooth_width: float = 4.0,
    num_teeth: int = 20,
    num_mounting_holes: int = 4,
    mounting_hole_diameter: float = 6.0
) -> bytes:
    """
    Generates a gear with the given parameters and returns the STL content as bytes.
    """
    logger.info(f"Generating gear with: OD={outer_diameter}, ID={inner_diameter}, Teeth={num_teeth}")
    
    try:
        # 1. Main body
        wheel = cq.Workplane("XY").cylinder(thickness, outer_diameter / 2.0)

        # 2. Inner hole
        wheel = wheel.faces(">Z").workplane().hole(inner_diameter)

        # 3. Teeth
        # Start with a single tooth
        tooth = (cq.Workplane("XY")
                 .moveTo(outer_diameter / 2.0 - tooth_height, 0)
                 .lineTo(outer_diameter / 2.0, tooth_width / 2.0)
                 .lineTo(outer_diameter / 2.0, -tooth_width / 2.0)
                 .close()
                 .extrude(thickness))

        # Pattern the teeth
        teeth = cq.Workplane("XY")
        for i in range(num_teeth):
            angle = i * 360.0 / num_teeth
            rotated_tooth = tooth.rotate((0, 0, 0), (0, 0, 1), angle)
            teeth = teeth.union(rotated_tooth)

        # Union wheel and teeth
        result = wheel.union(teeth)

        # 4. Mounting holes
        if num_mounting_holes > 0:
            mounting_hole_radius = (outer_diameter - inner_diameter) / 4.0 + inner_diameter / 2.0 # Roughly midway
            
            # Simple heuristic for mounting hole radius if not provided
            # Or we can just keep it fixed relative to size or pass it in. 
            # I'll use a calculated position for simplicity in the UI.
            
            mounting_hole_radius = inner_diameter / 2.0 + (outer_diameter/2.0 - inner_diameter/2.0) * 0.5

            base_hole = (cq.Workplane("XY")
                         .moveTo(mounting_hole_radius, 0)
                         .cylinder(thickness, mounting_hole_diameter / 2.0))
            
            mounting_holes = cq.Workplane("XY")
            for i in range(num_mounting_holes):
                angle = i * 360.0 / num_mounting_holes
                rotated_hole = base_hole.rotate((0, 0, 0), (0, 0, 1), angle)
                mounting_holes = mounting_holes.union(rotated_hole)
            
            result = result.cut(mounting_holes)

        # Export to STL string
        # CadQuery exportString returns the content
        # Note: tolerance/angularTolerance can be adjusted for finer meshes
        
        # We need a temporary file because exportString might not be available or behaves differently 
        # in some versions, but standard export uses Tesselators.
        # Let's try creating a temporary file and reading it back, it's safer.
        
        with tempfile.NamedTemporaryFile(suffix=".stl", delete=False) as tmp:
            tmp_path = tmp.name
        
        cq.exporters.export(result, tmp_path)
        
        with open(tmp_path, 'rb') as f:
            stl_content = f.read()
            
        os.unlink(tmp_path)
        
        logger.info("Gear generation successful")
        return stl_content

    except Exception as e:
        logger.error(f"Failed to generate gear: {e}")
        raise e
