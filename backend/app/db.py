from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Create SQLAlchemy engine
engine = create_engine(settings.DATABASE_URL, echo=False, future=True)

# Session factory for DB access
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True
)

# Base class for ORM models
Base = declarative_base()
