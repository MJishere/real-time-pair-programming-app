from pydantic import BaseModel

# Pydantic schemas defining request and response data structures for the API
class CreateRoomResponse(BaseModel):
    roomId: str

class AutocompleteRequest(BaseModel):
    code: str
    cursorPosition: int
    language: str

class AutocompleteResponse(BaseModel):
    suggestion: str
