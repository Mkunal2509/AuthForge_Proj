from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import Base, engine
from app.api.transcription import router as transcription_router
from app.api.registration import router as registration_router
from app.api.login import router as login_router
from app.api.liveness import router as liveness_router
from app.api.history import router as history_router

Base.metadata.create_all(bind=engine)


app = FastAPI(
    
    title=settings.APP_NAME,
    description=(
        "Multilingual Voice Authentication System "
        "supporting English, Hindi and Marathi."
    ),
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcription_router)
app.include_router(registration_router)
app.include_router(login_router)
app.include_router(liveness_router)
app.include_router(history_router)


@app.get("/")
def root():

    return {
        "message": "Multilingual Voice Authentication API",
        "status": "running"
    }


@app.get("/health")
def health():

    return {
        "status": "healthy",
        "message": "API is running successfully"
    }