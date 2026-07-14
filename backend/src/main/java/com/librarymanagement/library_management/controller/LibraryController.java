package com.librarymanagement.library_management.controller;

import com.librarymanagement.library_management.dto.IssuedBookDetailDto;
import com.librarymanagement.library_management.dto.StudentDashboardDto;
import com.librarymanagement.library_management.model.Book;
import com.librarymanagement.library_management.model.BookIssue;
import com.librarymanagement.library_management.model.User;
import com.librarymanagement.library_management.repository.BookIssueRepository;
import com.librarymanagement.library_management.repository.BookRepository;
import com.librarymanagement.library_management.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class LibraryController {

    private final UserRepository userRepository;
    private final BookRepository bookRepository;
    private final BookIssueRepository bookIssueRepository;

    public LibraryController(UserRepository userRepository,
            BookRepository bookRepository,
            BookIssueRepository bookIssueRepository) {
        this.userRepository = userRepository;
        this.bookRepository = bookRepository;
        this.bookIssueRepository = bookIssueRepository;
    }

    // Helper method to validate student/teacher/faculty role and credentials
    private User validateStudent(String roleHeader, Long idHeader) {
        if (roleHeader == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied. Role header required.");
        }
        String cleanRole = roleHeader.trim().toUpperCase();
        if (!"STUDENT".equals(cleanRole) && !"TEACHER".equals(cleanRole) && !"FACULTY".equals(cleanRole) && !"HEAD".equals(cleanRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied. Student/Faculty role required.");
        }
        if (idHeader == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing X-User-Id header.");
        }
        
        syncUsersFromAuthService();

        return userRepository.findById(idHeader)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));
    }

    // Helper method to validate librarian role
    private void validateLibrarian(String roleHeader) {
        if (roleHeader == null || !"LIBRARIAN".equalsIgnoreCase(roleHeader.trim())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied. Librarian role required.");
        }
    }

    private void syncUsersFromAuthService() {
        RestTemplate restTemplate = new RestTemplate();
        try {
            String url = "http://localhost:8080/api/auth/users";
            List<?> usersList = restTemplate.getForObject(url, List.class);
            if (usersList != null) {
                for (Object item : usersList) {
                    if (item instanceof Map) {
                        Map<?, ?> u = (Map<?, ?>) item;
                        Long id = ((Number) u.get("id")).longValue();
                        String username = (String) u.get("username");
                        String role = (String) u.get("role");
                        String subRole = (String) u.get("subRole");
                        String fullName = (String) u.get("fullName");
                        String email = (String) u.get("email");
                        
                        String r = role != null ? role.toUpperCase().trim() : "";
                        String sr = subRole != null ? subRole.toUpperCase().trim() : "";
                        
                        boolean isLibraryUser = "STUDENT".equals(r) || "FACULTY".equals(r) || "HEAD".equals(r) || "ADMIN".equals(r) || 
                                               ("STAFF".equals(r) && "LIBRARIAN".equals(sr));
                        
                        if (isLibraryUser) {
                            String libraryRole = "STUDENT";
                            if ("ADMIN".equals(r) || ("STAFF".equals(r) && "LIBRARIAN".equals(sr))) {
                                libraryRole = "LIBRARIAN";
                            } else if ("FACULTY".equals(r) || "HEAD".equals(r)) {
                                libraryRole = "FACULTY";
                            }
                            
                            java.util.Optional<User> localUserOpt = userRepository.findById(id);
                            if (localUserOpt.isPresent()) {
                                User localUser = localUserOpt.get();
                                localUser.setUsername(username);
                                localUser.setRole(libraryRole);
                                localUser.setName(fullName != null ? fullName : username);
                                localUser.setEmail(email);
                                userRepository.save(localUser);
                            } else {
                                User newUser = new User();
                                newUser.setId(id);
                                newUser.setUsername(username);
                                newUser.setRole(libraryRole);
                                newUser.setName(fullName != null ? fullName : username);
                                newUser.setEmail(email);
                                userRepository.save(newUser);
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to sync users from auth-service: " + e.getMessage());
        }
    }

    // STUDENT ENDPOINTS

    @GetMapping("/student/books")
    public ResponseEntity<List<Book>> getBooksForStudent(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestParam(value = "search", required = false) String search) {
        validateStudent(role, userId);

        List<Book> books;
        if (search != null && !search.trim().isEmpty()) {
            books = bookRepository.searchBooks(search.trim());
        } else {
            books = bookRepository.findAll();
        }
        return ResponseEntity.ok(books);
    }

    @GetMapping("/student/dashboard")
    public ResponseEntity<StudentDashboardDto> getStudentDashboard(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestParam(value = "simulatedDate", required = false) String simulatedDateStr) {
        User student = validateStudent(role, userId);

        LocalDate referenceDate = LocalDate.now();
        if (simulatedDateStr != null && !simulatedDateStr.trim().isEmpty()) {
            try {
                referenceDate = LocalDate.parse(simulatedDateStr.trim());
            } catch (DateTimeParseException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Invalid date format for simulatedDate. Use YYYY-MM-DD.");
            }
        }

        List<BookIssue> activeIssues = bookIssueRepository.findByStudentIdAndReturnDateIsNull(student.getId());
        List<IssuedBookDetailDto> issuedBookDetails = new ArrayList<>();
        double totalFine = 0.0;

        for (BookIssue issue : activeIssues) {
            Book book = bookRepository.findById(issue.getBookId()).orElse(null);
            String title = book != null ? book.getTitle() : "Unknown Title";
            String author = book != null ? book.getAuthor() : "Unknown Author";

            long daysOverdue = 0;
            double fine = 0.0;

            if (referenceDate.isAfter(issue.getDueDate())) {
                daysOverdue = ChronoUnit.DAYS.between(issue.getDueDate(), referenceDate);
                fine = daysOverdue * 1.0;
            }

            totalFine += fine;
            issuedBookDetails.add(new IssuedBookDetailDto(
                    issue.getBookId(),
                    title,
                    author,
                    issue.getIssueDate(),
                    issue.getDueDate(),
                    daysOverdue,
                    fine));
        }

        StudentDashboardDto dashboard = new StudentDashboardDto(
                student.getId(),
                student.getUsername(),
                activeIssues.size(),
                totalFine,
                issuedBookDetails);

        return ResponseEntity.ok(dashboard);
    }

    // LIBRARIAN ENDPOINTS

    @GetMapping("/librarian/issues")
    public ResponseEntity<List<BookIssue>> getAllIssues(@RequestHeader(value = "X-User-Role", required = false) String role) {
        validateLibrarian(role);
        return ResponseEntity.ok(bookIssueRepository.findAll());
    }

    @PostMapping("/librarian/issues")
    public ResponseEntity<BookIssue> issueBookForStudent(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam Long studentId,
            @RequestParam Long bookId) {
        validateLibrarian(role);

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found."));

        if (!"STUDENT".equalsIgnoreCase(student.getRole()) && 
            !"TEACHER".equalsIgnoreCase(student.getRole()) && 
            !"FACULTY".equalsIgnoreCase(student.getRole()) && 
            !"HEAD".equalsIgnoreCase(student.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User must be a student or a faculty member.");
        }

        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));

        if (book.getAvailableCopies() == null) {
            book.setAvailableCopies(book.isAvailable() ? 1 : 0);
        }

        if (book.getAvailableCopies() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Book is not available for issue. Current copies: " + book.getAvailableCopies());
        }

        book.setAvailableCopies(book.getAvailableCopies() - 1);
        if (book.getAvailableCopies() == 0) {
            book.setAvailable(false);
            book.setTag("ISSUED");
        }
        bookRepository.save(book);

        LocalDate today = LocalDate.now();
        LocalDate dueDate = today.plusDays(30); // 30-day default issue duration

        BookIssue issue = new BookIssue(bookId, student.getId(), today, dueDate);
        BookIssue savedIssue = bookIssueRepository.save(issue);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedIssue);
    }

    @PostMapping("/librarian/returns")
    public ResponseEntity<Map<String, Object>> returnBookForStudent(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam Long studentId,
            @RequestParam Long bookId) {
        try {
            validateLibrarian(role);

            User student = userRepository.findById(studentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found."));

            List<BookIssue> issues = bookIssueRepository.findByBookIdAndStudentIdAndReturnDateIsNull(bookId, student.getId());
            if (issues.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "No active issue record found for this book and student.");
            }
            BookIssue issue = issues.get(0);

            Book book = bookRepository.findById(bookId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));

            LocalDate today = LocalDate.now();
            issue.setReturnDate(today);
            bookIssueRepository.save(issue);

            if (book.getAvailableCopies() == null) {
                book.setAvailableCopies(book.isAvailable() ? 1 : 0);
            }
            book.setAvailableCopies(book.getAvailableCopies() + 1);
            book.setAvailable(true);
            book.setTag("AVAILABLE");
            bookRepository.save(book);

            // Fine details: 1 rupee for each day after deadline
            long daysOverdue = 0;
            double fine = 0.0;
            if (today.isAfter(issue.getDueDate())) {
                daysOverdue = ChronoUnit.DAYS.between(issue.getDueDate(), today);
                fine = daysOverdue * 1.0;
            }

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Book returned successfully");
            response.put("bookId", book.getId());
            response.put("studentId", student.getId());
            response.put("title", book.getTitle());
            response.put("returnDate", today);
            response.put("dueDate", issue.getDueDate());
            response.put("daysOverdue", daysOverdue);
            response.put("fineAmount", fine);

            return ResponseEntity.ok(response);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            e.printStackTrace();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error returning book: " + e.getMessage(), e);
        }
    }

    @GetMapping("/librarian/books")
    public ResponseEntity<List<Book>> getAllBooksForLibrarian(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam(value = "search", required = false) String search) {
        validateLibrarian(role);
        List<Book> books;
        if (search != null && !search.trim().isEmpty()) {
            books = bookRepository.searchBooks(search.trim());
        } else {
            books = bookRepository.findAll();
        }
        return ResponseEntity.ok(books);
    }

    @PostMapping("/librarian/books")
    public ResponseEntity<Book> addBook(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestBody Book book) {
        validateLibrarian(role);

        if (book.getTitle() == null || book.getTitle().trim().isEmpty() ||
                book.getAuthor() == null || book.getAuthor().trim().isEmpty() ||
                book.getIsbn() == null || book.getIsbn().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Book title, author, and ISBN are required.");
        }

        if (bookRepository.findByIsbn(book.getIsbn()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A book with the same ISBN already exists.");
        }

        if (book.getQuantity() == null) {
            book.setQuantity(1);
        }
        book.setAvailableCopies(book.getQuantity());
        book.setAvailable(book.getQuantity() > 0);
        book.setTag(book.getQuantity() > 0 ? "AVAILABLE" : "UNAVAILABLE");
        if (book.getCategory() == null || book.getCategory().trim().isEmpty()) {
            book.setCategory("General");
        }

        Book savedBook = bookRepository.save(book);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedBook);
    }

    @PutMapping("/librarian/books/{bookId}")
    public ResponseEntity<Book> updateBook(
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @PathVariable Long bookId,
            @RequestBody Book updatedBook) {
        validateLibrarian(roleHeader);

        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));

        if (updatedBook.getTitle() == null || updatedBook.getTitle().trim().isEmpty() ||
                updatedBook.getAuthor() == null || updatedBook.getAuthor().trim().isEmpty() ||
                updatedBook.getIsbn() == null || updatedBook.getIsbn().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Book title, author, and ISBN are required.");
        }

        java.util.Optional<Book> duplicateIsbn = bookRepository.findByIsbn(updatedBook.getIsbn().trim());
        if (duplicateIsbn.isPresent() && !duplicateIsbn.get().getId().equals(bookId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A book with the same ISBN already exists.");
        }

        int oldQuantity = book.getQuantity() != null ? book.getQuantity() : 1;
        int newQuantity = updatedBook.getQuantity() != null ? updatedBook.getQuantity() : 1;
        int currentAvailable = book.getAvailableCopies() != null ? book.getAvailableCopies() : (book.isAvailable() ? 1 : 0);

        int newAvailable = Math.max(0, currentAvailable + (newQuantity - oldQuantity));

        book.setTitle(updatedBook.getTitle().trim());
        book.setAuthor(updatedBook.getAuthor().trim());
        book.setIsbn(updatedBook.getIsbn().trim());
        book.setCategory(updatedBook.getCategory() != null ? updatedBook.getCategory().trim() : "General");
        book.setQuantity(newQuantity);
        book.setAvailableCopies(newAvailable);
        book.setAvailable(newAvailable > 0);
        book.setTag(newAvailable > 0 ? "AVAILABLE" : "UNAVAILABLE");

        Book savedBook = bookRepository.save(book);
        return ResponseEntity.ok(savedBook);
    }

    @DeleteMapping("/librarian/books/{bookId}")
    public ResponseEntity<Void> deleteBook(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @PathVariable Long bookId) {
        validateLibrarian(role);

        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));

        // If a book is currently issued, librarian should not delete it directly
        // without issuing/returning state handling.
        // But for simplicity, we allow deleting and cleaning up any active issues if
        // they exist.
        bookRepository.delete(book);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/librarian/books/{bookId}/availability")
    public ResponseEntity<Book> updateBookAvailability(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @PathVariable Long bookId,
            @RequestParam boolean available) {
        validateLibrarian(role);

        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));

        book.setAvailable(available);
        if (available) {
            book.setTag("AVAILABLE");
            if (book.getAvailableCopies() == null || book.getAvailableCopies() == 0) {
                book.setAvailableCopies(book.getQuantity() != null ? book.getQuantity() : 1);
            }
        } else {
            book.setTag("UNAVAILABLE");
            book.setAvailableCopies(0);
        }

        Book updatedBook = bookRepository.save(book);
        return ResponseEntity.ok(updatedBook);
    }

    @PostMapping("/users/login")
    public ResponseEntity<User> login(@RequestParam String username, @RequestParam String role) {
        java.util.Optional<User> existing = userRepository.findByUsername(username.trim());
        if (existing.isPresent()) {
            User user = existing.get();
            if (user.getRole().equalsIgnoreCase(role.trim())) {
                return ResponseEntity.ok(user);
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role mismatch");
            }
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found.");
    }

    @GetMapping("/librarian/users")
    public ResponseEntity<List<User>> getAllUsers(@RequestHeader(value = "X-User-Role", required = false) String role) {
        validateLibrarian(role);
        syncUsersFromAuthService();
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping("/librarian/users")
    public ResponseEntity<User> createUser(
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestBody User user) {
        validateLibrarian(roleHeader);

        if (user.getUsername() == null || user.getUsername().trim().isEmpty() ||
                user.getRole() == null || user.getRole().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username and role are required.");
        }

        if (userRepository.findByUsername(user.getUsername().trim()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with the same username already exists.");
        }

        User newUser = new User(user.getUsername().trim(), user.getRole().toUpperCase().trim());
        newUser.setId(System.currentTimeMillis() % 100000000L);
        newUser.setName(user.getName() != null ? user.getName().trim() : user.getUsername().trim());
        
        // Generate email if not explicitly provided or formatted
        if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
            if ("STUDENT".equalsIgnoreCase(newUser.getRole())) {
                newUser.setEmail(newUser.getUsername().toLowerCase() + "@sgsits.ac.in");
            } else {
                String nameLower = newUser.getName().toLowerCase().replace(" ", "_");
                newUser.setEmail(nameLower + "@sgsits.ac.in");
            }
        } else {
            newUser.setEmail(user.getEmail().trim());
        }

        User savedUser = userRepository.save(newUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
    }

    @DeleteMapping("/librarian/users/{id}")
    public ResponseEntity<Void> deleteUser(
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @PathVariable Long id) {
        validateLibrarian(roleHeader);

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

        // Clean up issues for this deleted student/member
        List<BookIssue> issues = bookIssueRepository.findByStudentIdAndReturnDateIsNull(id);
        for (BookIssue issue : issues) {
            bookRepository.findById(issue.getBookId()).ifPresent(b -> {
                b.setAvailable(true);
                b.setTag("AVAILABLE");
                bookRepository.save(b);
            });
        }
        bookIssueRepository.deleteAll(issues);

        userRepository.delete(user);
        return ResponseEntity.noContent().build();
    }
}
