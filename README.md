# Real-Time Pair Programming

This project was developed as a complete **Full Stack Python Project** demonstrating skills in:

- Backend development with FastAPI  
- Real-time communication using WebSockets  
- Database persistence with PostgreSQL  
- Frontend development with React + TypeScript + Monaco Editor 
- State management using Redux 
- Containerization using Docker for consistent local and production environments
- Simple Deployment on EC2 using docker compose

The application allows two users to join the same room and collaboratively edit code in real time, with support for a mock AI autocompletion. Uses docker based setup for simple and consistent deployment.

# Live Demo

**Live Application Link : http://52.0.61.202**
# How to Run the Project ( EC2 & on Locally)
### Note: The project uses Docker Compose, so both services (backend and frontend) run together automatically - no separate setup is required.
### Running on EC2:

    1. Create an EC2 Instance on AWS Cloud ( Example - Ubuntu)

    2. Connect to the instance using AWS Instance Connect feature or through and SSH client like putty 
    ( Make sure to open the 22 port for your IP address in the instance security group)

    3. Install Docker + Docker compose using the below commands:
        sudo apt-get update
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh

    4. Clone the Github repo using below code
        git clone https://github.com/MJishere/real-time-pair-programming-app.git

    5. Navigate to the cloned repo
        cd real-time-pair-programming-app
    
    6. Start containers:
        sudo docker compose up --build -d

    7. Application will be live on http://EC2_Public_IP:80

### Running Locally

    1. Install Docker Desktop on your computer

    2. Start Docker

    3. Clone Github repo to your local computer 

    4. Navigate inside the repo -> /real-time-pair-programming-app/

    5. Start the containers
        docker compose up --build -d

    6. Application will be live on localhost:80
# Architecture Summary

**Backend**:

    1. POST /rooms -> Creates new room

    2. POST /autocomplete -> Returns mocked AI suggestion

    3. WebSocket /ws/<roomId> → Real-time code collaboration
    
    4. room_manager.py → Manages in-memory + DB room state

    5. PostgreSQL persistence for room code


**Frontend**:

    1. HomePage → Create / Join Rooms
    
    2. EditorMonaco.tsx → Monaco editor integration

    3. wsManager.ts → Central WebSocket manager

    4. Redux Toolkit → Stores room ID, status, remote updates

    5. Autocomplete → Calls backend POST /autocomplete

    
**Deployment**
    
    1. Dockerized frontend + backend + postgress

    2. Deployed on EC2 using Docker Compose

## Architecture Diagram - Real Time Pair Programming
![Architecture Diagram – Real-time Pair-Programming App](https://raw.githubusercontent.com/MJishere/real-time-pair-programming-app/master/Architecture_diagram.png)

## Environment Variables

This project works out-of-the-box with Docker Compose, but the following environment variables can be customized if needed:

PostgreSQL connection string used by FastAPI

    DATABASE_URL = postgresql://postgres:postgres@postgres:5432/postgres 


Frontend -> Backend API URL

    VITE_API_URL = (empty -> uses Nginx proxy with relative paths)
## Tech Stack

| Category             | Tools/Services                                                                |
| ----------------- | ------------------------------------------------------------------ |
| Frontend  | React, TypeScript, Redux |
| Backend | FastAPI |
| Database | Postgres |
| Container | Docker |
| Cloud | AWS EC2 |
| SCM | Git and Github |



## What Can be Improved ?

    1. Use CRDT or OT algorithms for conflict-free real-time collaboration.
    
    2. Add authentication for users

    3. Add real AI-based suggestion and auto code completion

    4. Implement a scheduled cleanup job to automatically remove old and inactive room data after a defined retention period.
    
    5. Multiple programming language selection and editor support

    6. Add SSL certificates and serve the app over HTTPS for secure communication.


## Known Limitations

    1. Uses a simple last-write-wins sync model — no CRDT or OT for conflict-free merging.
    
    2. Autocomplete is mocked, not AI-powered.

    3. No authentication

    4. WebSocket session are kept in-memory, so scaling to multiple instance would require Redis.

    5. Editor does not support multi programming languages suggestion, only python

## Authors

Manoj M | manojmjhere2@gmail.com


## 🔗 Links

[![linkedin](https://img.shields.io/badge/github-808080?style=for-the-badge&logo=github&logoColor=grey)](https://github.com/MJishere)

[![github](https://img.shields.io/badge/linkedin-0A66C2?style=for-the-badge&logo=github&logoColor=white)](https://www.linkedin.com/in/manoj-m-mj/)
