from sqlalchemy import Column, String, Text
from app.db import Base

class Room(Base):
    __tablename__ = "rooms"
    room_id = Column(String(36), primary_key=True, index=True)
    code = Column(Text, nullable=True, default="")
