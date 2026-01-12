from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import Response
from .gear_generator import generate_gear
from .log_client import logger

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GearParams(BaseModel):
    outer_diameter: float = 80.0
    inner_diameter: float = 20.0
    thickness: float = 8.0
    tooth_height: float = 6.0
    tooth_width: float = 4.0
    num_teeth: int = 20
    num_mounting_holes: int = 4
    mounting_hole_diameter: float = 6.0

@app.on_event("startup")
async def startup_event():
    logger.connect()
    logger.info("Backend service started")

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {"message": "Code CAD API. Visit http://localhost:8080 for the interface."}

@app.post("/generate")
def generate_gear_endpoint(params: GearParams):
    try:
        stl_data = generate_gear(
            outer_diameter=params.outer_diameter,
            inner_diameter=params.inner_diameter,
            thickness=params.thickness,
            tooth_height=params.tooth_height,
            tooth_width=params.tooth_width,
            num_teeth=params.num_teeth,
            num_mounting_holes=params.num_mounting_holes,
            mounting_hole_diameter=params.mounting_hole_diameter
        )
        return Response(content=stl_data, media_type="application/vnd.ms-pki.stl")
    except Exception as e:
        logger.error(f"Endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
