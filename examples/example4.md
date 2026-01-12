# CadQuery Example 4: Geared Wheel with Mounting Holes

## Overview
This is an intermediate-level CadQuery example that demonstrates a practical mechanical component - a geared wheel with mounting holes. This example showcases several advanced CadQuery features and techniques.

## Features Demonstrated

### 1. Multiple Workplanes and Operations
- Uses different workplanes for different operations
- Demonstrates proper workplane management for complex geometry

### 2. Circular Patterns
- Creates gear teeth using mathematical calculations and rotation
- Implements mounting holes in a circular pattern around the center
- Shows how to use trigonometry for precise positioning

### 3. Complex Boolean Operations
- Union operations to combine the wheel body with teeth
- Cut operations to create mounting holes
- Demonstrates proper order of operations

### 4. Advanced Geometry
- Custom tooth profile using line segments
- Mathematical positioning of features
- Parameterized design for easy modification

### 5. Error Handling and Robustness
- Comprehensive error handling with try-catch blocks
- Progress indicators for each construction step
- Graceful fallback for problematic operations

## Code Structure

### Parameters Section
All dimensions are defined as parameters at the top, making the design easily modifiable:
- `outer_diameter`: Overall wheel size
- `inner_diameter`: Center hole size
- `thickness`: Material thickness
- `tooth_height` and `tooth_width`: Gear tooth dimensions
- `num_teeth`: Number of gear teeth
- `mounting_hole_diameter`: Size of mounting holes
- `num_mounting_holes`: Number of mounting holes
- `mounting_hole_radius`: Distance from center for mounting holes

### Main Construction Steps
1. **Wheel Body**: Create main cylinder and center hole
2. **Gear Teeth**: Create single tooth profile and replicate using rotation
3. **Mounting Holes**: Create holes in circular pattern
4. **Assembly**: Combine all components using boolean operations
5. **Display**: Show the 3D model with progress feedback

## Learning Objectives

This example teaches:
- How to work with multiple geometric operations
- Implementing circular patterns manually
- Proper use of boolean operations
- Mathematical positioning in 3D space
- Parameterized design principles
- Error handling in CadQuery scripts
- Progress tracking and user feedback

## Difficulty Level: Intermediate

This example is more complex than the basic examples because it:
- Requires understanding of multiple CadQuery concepts
- Involves mathematical calculations
- Uses multiple workplanes and operations
- Combines several techniques in one design
- Has practical mechanical application
- Includes error handling and user feedback

## Technical Notes

### Mounting Holes Implementation
The mounting holes are created using cylinders positioned at calculated angles, then rotated and unioned together. This approach is more reliable than using the `hole()` method on empty workplanes.

### Filleting Considerations
The fillet operation was removed from this example due to potential compatibility issues with certain CadQuery versions. Filleting can be added later once the basic geometry is working correctly.

### Error Handling
The script includes comprehensive error handling to catch and report any issues during construction, making it easier to debug and modify.

## Potential Improvements

Future enhancements could include:
- Helical gear teeth for 3D printing
- Variable tooth profiles for different gear types
- Stress analysis considerations
- Export to different file formats
- Animation of gear rotation
- Reintroduction of fillet operations
- More sophisticated tooth profiles

## Usage

Run the script to see the 3D model:
```bash
python example4_geared_wheel.py
```

The script will:
1. Display progress indicators for each construction step
2. Show the 3D model in the viewer
3. Print specifications to the console
4. Handle any errors gracefully

## Output

When successful, the script will display:
- ✓ Progress indicators for each step
- 🎉 Success message
- 📏 Detailed specifications
- 🔩 3D model in the viewer

The final result is a functional geared wheel with:
- 80mm outer diameter
- 20mm center hole
- 20 gear teeth
- 4 mounting holes
- 8mm thickness
