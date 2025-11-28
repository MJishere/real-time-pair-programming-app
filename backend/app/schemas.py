from pydantic import BaseModel

class CreateRoomResponse(BaseModel):
    roomId: str

class AutocompleteRequest(BaseModel):
    code: str
    cursorPosition: int
    language: str

class AutocompleteResponse(BaseModel):
    suggestion: str
