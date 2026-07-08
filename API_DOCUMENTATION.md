# Library Management System - Backend API Documentation

The backend service is built using Spring Boot. All API requests are prefixed with `/api/v1/library`. Cross-Origin Resource Sharing (CORS) is enabled for all origins.

---

## Authentication
Protected endpoints now use JWTs passed through the `Authorization: Bearer <token>` header.

The token is decoded by the backend and the following claims are used:
* `role`: `STUDENT`, `TEACHER`, or `LIBRARIAN`
* `studentId`: the user ID for student/teacher scoped requests

The old `X-User-Role` and `X-User-Id` headers are no longer used.

## Standard Response Format
Success responses are wrapped as:
```json
{ "success": true, "data": { ... }, "message": "Success" }
```

Errors are wrapped as:
```json
{ "success": false, "error": "ERROR_CODE", "message": "..." }
```

---

## User Endpoints

### 1. User Login
Authenticates an existing user by username and role. 
* **Auto-creation Logic**: 
  * If the role is `STUDENT` and the username does not exist, the student account is automatically created.
  * If the role is `LIBRARIAN` and the username is `librarian1`, the librarian account is automatically created for ease of testing.

* **Path**: `/api/v1/library/users/login`
* **HTTP Method**: `POST`
* **Query Parameters**:
  * `username` (String): The username of the user (e.g., `john_doe` or `librarian1`).
  * `role` (String): The role of the user (`STUDENT` or `LIBRARIAN`).
* **Success Status Code**: `200 OK`
* **Error Status Codes**:
  * `400 Bad Request`: Role mismatch if username exists with a different role.
  * `401 Unauthorized`: User not found and cannot be auto-created.

#### Example Request
```http
POST /api/users/login?username=student_user&role=STUDENT HTTP/1.1
Host: localhost:8082
```

#### Example Response
```json
{
  "id": 1,
  "username": "student_user",
  "role": "STUDENT"
}
```

---

### 2. Get All Users (Librarian Only)
Retrieves a list of all registered users in the system.

* **Path**: `/api/v1/library/librarian/users`
* **HTTP Method**: `GET`
* **Headers**:
  * `X-User-Role` (String): Must be `LIBRARIAN`
* **Success Status Code**: `200 OK`
* **Error Status Codes**:
  * `403 Forbidden`: Access denied if role header is not `LIBRARIAN` or missing.

#### Example Request
```http
GET /api/librarian/users HTTP/1.1
Host: localhost:8082
X-User-Role: LIBRARIAN
```

#### Example Response
```json
[
  {
    "id": 1,
    "username": "student_user",
    "role": "STUDENT"
  },
  {
    "id": 2,
    "username": "librarian1",
    "role": "LIBRARIAN"
  }
]
```

---

## Book Endpoints

### 1. Get Books for Student
Retrieves the list of all books or searches books by matching title/author keyword.

* **Path**: `/api/v1/library/student/books`
* **HTTP Method**: `GET`
* **Headers**:
  * `X-User-Role` (String): Must be `STUDENT`
  * `X-User-Id` (Long): The ID of the student
* **Query Parameters**:
  * `search` (String, optional): The search query to filter books by title or author.
* **Success Status Code**: `200 OK`
* **Error Status Codes**:
  * `400 Bad Request`: Missing `X-User-Id` header.
  * `401 Unauthorized`: Student not found.
  * `403 Forbidden`: Access denied if role header is not `STUDENT`.

#### Example Request
```http
GET /api/student/books?search=Spring HTTP/1.1
Host: localhost:8082
X-User-Role: STUDENT
X-User-Id: 1
```

#### Example Response
```json
[
  {
    "id": 5,
    "title": "Spring Boot in Action",
    "author": "Craig Walls",
    "isbn": "9781617292545",
    "available": true,
    "tag": "AVAILABLE"
  }
]
```

---

### 2. Get All Books for Librarian
Retrieves the list of all books or searches books by matching title/author keyword for the librarian.

* **Path**: `/api/v1/library/librarian/books`
* **HTTP Method**: `GET`
* **Headers**:
  * `X-User-Role` (String): Must be `LIBRARIAN`
* **Query Parameters**:
  * `search` (String, optional): The search query to filter books by title or author.
* **Success Status Code**: `200 OK`
* **Error Status Codes**:
  * `403 Forbidden`: Access denied if role header is not `LIBRARIAN`.

#### Example Request
```http
GET /api/librarian/books HTTP/1.1
Host: localhost:8082
X-User-Role: LIBRARIAN
```

#### Example Response
```json
[
  {
    "id": 5,
    "title": "Spring Boot in Action",
    "author": "Craig Walls",
    "isbn": "9781617292545",
    "available": false,
    "tag": "ISSUED"
  }
]
```

---

### 3. Student Fine Status
Returns whether a student has pending fines and the current total fine amount.

* **Path**: `/api/v1/library/students/{studentId}/fine-status`
* **HTTP Method**: `GET`
* **Response**:
```json
{
  "studentId": 42,
  "hasPendingFine": true,
  "totalFineAmount": 15.0
}
```

---

### 4. Student Active Issue Status
Returns whether a student currently has any active book issue.

* **Path**: `/api/v1/library/students/{studentId}/has-active-issue`
* **HTTP Method**: `GET`
* **Response**:
```json
{
  "studentId": 42,
  "hasActiveIssue": true
}
```

---

### 3. Add Book (Librarian Only)
Adds a new book to the library catalog.

* **Path**: `/api/librarian/books`
* **HTTP Method**: `POST`
* **Headers**:
  * `X-User-Role` (String): Must be `LIBRARIAN`
* **Request Body (JSON)**:
  * `title` (String, required): The title of the book.
  * `author` (String, required): The author of the book.
  * `isbn` (String, required): The unique ISBN of the book.
* **Success Status Code**: `201 Created`
* **Error Status Codes**:
  * `400 Bad Request`: Title, author, or ISBN are empty or missing.
  * `409 Conflict`: A book with the same ISBN already exists.
  * `403 Forbidden`: Access denied.

#### Example Request
```http
POST /api/librarian/books HTTP/1.1
Host: localhost:8082
X-User-Role: LIBRARIAN
Content-Type: application/json

{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "9780132350884"
}
```

#### Example Response
```json
{
  "id": 10,
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "9780132350884",
  "available": true,
  "tag": "AVAILABLE"
}
```

---

### 4. Delete Book (Librarian Only)
Deletes a book from the library catalog.

* **Path**: `/api/librarian/books/{bookId}`
* **HTTP Method**: `DELETE`
* **Headers**:
  * `X-User-Role` (String): Must be `LIBRARIAN`
* **Path Parameters**:
  * `bookId` (Long): The ID of the book to delete.
* **Success Status Code**: `204 No Content`
* **Error Status Codes**:
  * `404 Not Found`: Book not found.
  * `403 Forbidden`: Access denied.

#### Example Request
```http
DELETE /api/librarian/books/10 HTTP/1.1
Host: localhost:8082
X-User-Role: LIBRARIAN
```

#### Example Response
*(No Response Body)*

---

### 5. Update Book Availability (Librarian Only)
Manually updates the availability status of a book (e.g. marking it unavailable due to damage/maintenance).

* **Path**: `/api/librarian/books/{bookId}/availability`
* **HTTP Method**: `PUT`
* **Headers**:
  * `X-User-Role` (String): Must be `LIBRARIAN`
* **Path Parameters**:
  * `bookId` (Long): The ID of the book.
* **Query Parameters**:
  * `available` (Boolean): New availability status (`true`/`false`).
* **Success Status Code**: `200 OK`
* **Error Status Codes**:
  * `404 Not Found`: Book not found.
  * `403 Forbidden`: Access denied.

#### Example Request
```http
PUT /api/librarian/books/10/availability?available=false HTTP/1.1
Host: localhost:8082
X-User-Role: LIBRARIAN
```

#### Example Response
```json
{
  "id": 10,
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "9780132350884",
  "available": false,
  "tag": "UNAVAILABLE"
}
```

---

## Borrow & Return Endpoints

### 1. Get Student Dashboard
Retrieves data summarizing a student's active book issues, due dates, overdue counts, and calculated fines.

* **Path**: `/api/student/dashboard`
* **HTTP Method**: `GET`
* **Headers**:
  * `X-User-Role` (String): Must be `STUDENT`
  * `X-User-Id` (Long): The ID of the student.
* **Query Parameters**:
  * `simulatedDate` (String, optional): Date formatted as `YYYY-MM-DD` to simulate fine calculation for that specific day.
* **Success Status Code**: `200 OK`
* **Error Status Codes**:
  * `400 Bad Request`: Invalid format for `simulatedDate`.
  * `403 Forbidden`: Access denied.
  * `401 Unauthorized`: Student not found.

#### Example Request
```http
GET /api/student/dashboard?simulatedDate=2026-07-20 HTTP/1.1
Host: localhost:8082
X-User-Role: STUDENT
X-User-Id: 1
```

#### Example Response
```json
{
  "studentId": 1,
  "username": "student_user",
  "booksIssuedCount": 1,
  "totalFine": 2.0,
  "issuedBooks": [
    {
      "bookId": 5,
      "bookTitle": "Spring Boot in Action",
      "author": "Craig Walls",
      "issueDate": "2026-07-04",
      "dueDate": "2026-07-18",
      "daysOverdue": 2,
      "fine": 2.0
    }
  ]
}
```

---

### 2. Get All Book Issues (Librarian Only)
Retrieves a complete list of all book borrow/issue transactions in the system.

* **Path**: `/api/librarian/issues`
* **HTTP Method**: `GET`
* **Headers**:
  * `X-User-Role` (String): Must be `LIBRARIAN`
* **Success Status Code**: `200 OK`
* **Error Status Codes**:
  * `403 Forbidden`: Access denied.

#### Example Request
```http
GET /api/librarian/issues HTTP/1.1
Host: localhost:8082
X-User-Role: LIBRARIAN
```

#### Example Response
```json
[
  {
    "id": 1,
    "bookId": 5,
    "studentId": 1,
    "issueDate": "2026-07-04",
    "dueDate": "2026-07-18",
    "returnDate": null
  }
]
```

---

### 3. Issue Book for Student (Librarian Only)
Issues an available book to a student user for a default duration of 14 days.

* **Path**: `/api/librarian/issues`
* **HTTP Method**: `POST`
* **Headers**:
  * `X-User-Role` (String): Must be `LIBRARIAN`
* **Query Parameters**:
  * `studentId` (Long): The ID of the student.
  * `bookId` (Long): The ID of the book.
* **Success Status Code**: `201 Created`
* **Error Status Codes**:
  * `400 Bad Request`: User is not a student, or book is already issued/unavailable.
  * `404 Not Found`: Student or Book not found.
  * `403 Forbidden`: Access denied.

#### Example Request
```http
POST /api/librarian/issues?studentId=1&bookId=5 HTTP/1.1
Host: localhost:8082
X-User-Role: LIBRARIAN
```

#### Example Response
```json
{
  "id": 2,
  "bookId": 5,
  "studentId": 1,
  "issueDate": "2026-07-04",
  "dueDate": "2026-07-18",
  "returnDate": null
}
```

---

### 4. Return Book for Student (Librarian Only)
Processes a book return, flags the book as available, sets the return date, and returns fine calculation details (1 unit per day overdue).

* **Path**: `/api/librarian/returns`
* **HTTP Method**: `POST`
* **Headers**:
  * `X-User-Role` (String): Must be `LIBRARIAN`
* **Query Parameters**:
  * `studentId` (Long): The ID of the student.
  * `bookId` (Long): The ID of the book.
* **Success Status Code**: `200 OK`
* **Error Status Codes**:
  * `400 Bad Request`: No active borrow/issue record found.
  * `404 Not Found`: Student or Book not found.
  * `403 Forbidden`: Access denied.

#### Example Request
```http
POST /api/librarian/returns?studentId=1&bookId=5 HTTP/1.1
Host: localhost:8082
X-User-Role: LIBRARIAN
```

#### Example Response
```json
{
  "message": "Book returned successfully",
  "bookId": 5,
  "studentId": 1,
  "title": "Spring Boot in Action",
  "returnDate": "2026-07-04",
  "dueDate": "2026-07-18",
  "daysOverdue": 0,
  "fineAmount": 0.0
}
```
