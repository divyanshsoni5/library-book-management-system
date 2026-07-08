# Library Book Management System

## Project Overview

The Library Book Management System is a full-stack web application built to digitize and simplify core library operations for a college/institutional setting. It allows library staff to manage a book catalog and handle the day-to-day workflow of issuing and returning books, with a clean web interface backed by a REST API.

The project was built as a one-day team sprint using a Spring Boot backend and an Angular frontend, with each team member contributing through a dedicated Git branch before merging into `main`.

## Features

- **Add Books** – Add new books to the library catalog with details like title, author, ISBN, and copy count
- **Issue Books** – Mark a book as issued, reducing its available copy count
- **Return Books** – Mark a book as returned, restoring its availability
- **Search Books** – Search the catalog by title, author, or ISBN

## Tech Stack

### Backend
- **Java 21** – Language runtime
- **Spring Boot** – Application framework
- **Spring Data JPA** – Database access and ORM
- **H2 Database** – In-memory database (zero setup, resets on restart)
- **Maven** – Build and dependency management
- **Spring Boot Validation** – Request validation

### Frontend
- **Angular** – Frontend framework (standalone components)
- **TypeScript**
- **Angular HttpClient** – API communication
- **Bootstrap / Angular Material** – UI styling and components

### Tools
- **Git & GitHub** – Version control, branch-per-member workflow with pull requests
- **Postman / Swagger UI** – API testing

## Setup Steps

### Prerequisites
Make sure the following are installed on your machine:
- Java 21 (JDK)
- Node.js (LTS version) and npm
- Angular CLI (`npm install -g @angular/cli`)
- Git

### 1. Clone the repository
```bash
git clone https://github.com/divyanshsoni5/library-book-management-system.git
cd library-book-management-system
```

### 2. Run the backend
```bash
cd backend
.\mvnw.cmd spring-boot:run      # Windows
./mvnw spring-boot:run          # Mac/Linux
```
The backend starts on `http://localhost:8082` (or the port configured in `application.properties`).

H2 console (for viewing the in-memory database) is available at:
```
http://localhost:8082/h2-console
```

### 3. Run the frontend
Open a new terminal:
```bash
cd frontend
npm install
ng serve
```
The frontend starts on `http://localhost:4200`.

### 4. Access the application
Open your browser and go to:
```
http://localhost:4200
```

## Project Structure

```
library-book-management-system/
├── backend/          # Spring Boot application
│   ├── src/
│   ├── pom.xml
│   └── ...
├── frontend/         # Angular application
│   ├── src/
│   ├── package.json
│   └── ...
└── README.md
```
