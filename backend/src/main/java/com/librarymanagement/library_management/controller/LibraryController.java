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

    // Helper method to validate student role and credentials
    private User validateStudent(String roleHeader, Long idHeader) {
        if (roleHeader == null || !"STUDENT".equalsIgnoreCase(roleHeader.trim())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied. Student role required.");
        }
        if (idHeader == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing X-User-Id header.");
        }
        return userRepository.findById(idHeader)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Student not found."));
    }

    // Helper method to validate librarian role
    private void validateLibrarian(String roleHeader) {
        if (roleHeader == null || !"LIBRARIAN".equalsIgnoreCase(roleHeader.trim())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied. Librarian role required.");
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

        if (!"STUDENT".equalsIgnoreCase(student.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a student.");
        }

        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));

        if (!book.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Book is not available for issue. Current tag: " + book.getTag());
        }

        book.setAvailable(false);
        book.setTag("ISSUED");
        bookRepository.save(book);

        LocalDate today = LocalDate.now();
        LocalDate dueDate = today.plusDays(14); // 14-day default issue duration

        BookIssue issue = new BookIssue(bookId, student.getId(), today, dueDate);
        BookIssue savedIssue = bookIssueRepository.save(issue);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedIssue);
    }

    @PostMapping("/librarian/returns")
    public ResponseEntity<Map<String, Object>> returnBookForStudent(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam Long studentId,
            @RequestParam Long bookId) {
        validateLibrarian(role);

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found."));

        BookIssue issue = bookIssueRepository.findByBookIdAndStudentIdAndReturnDateIsNull(bookId, student.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "No active issue record found for this book and student."));

        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));

        LocalDate today = LocalDate.now();
        issue.setReturnDate(today);
        bookIssueRepository.save(issue);

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

        // Set default states for new book
        book.setAvailable(true);
        book.setTag("AVAILABLE");

        Book savedBook = bookRepository.save(book);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedBook);
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

        // Update fields
        book.setAvailable(available);
        if (available) {
            book.setTag("AVAILABLE");
        } else {
            // Librarian marks unavailable (e.g. for maintenance)
            book.setTag("UNAVAILABLE");
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
        // Auto-create student if not exists
        if ("STUDENT".equalsIgnoreCase(role.trim())) {
            User newUser = userRepository.save(new User(username.trim(), "STUDENT"));
            return ResponseEntity.ok(newUser);
        }
        // Auto-create librarian for testing/ease of use if it's librarian1
        if ("LIBRARIAN".equalsIgnoreCase(role.trim()) && "librarian1".equalsIgnoreCase(username.trim())) {
            User newUser = userRepository.save(new User("librarian1", "LIBRARIAN"));
            return ResponseEntity.ok(newUser);
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found.");
    }

    @GetMapping("/librarian/users")
    public ResponseEntity<List<User>> getAllUsers(@RequestHeader(value = "X-User-Role", required = false) String role) {
        validateLibrarian(role);
        return ResponseEntity.ok(userRepository.findAll());
    }
}
