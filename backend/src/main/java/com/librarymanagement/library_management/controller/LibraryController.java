package com.librarymanagement.library_management.controller;

import com.librarymanagement.library_management.dto.ActiveIssueDto;
import com.librarymanagement.library_management.dto.FineStatusDto;
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
@RequestMapping("/api/v1/library")
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

    // Helper method to validate student/teacher role and credentials
    private User validateStudent(String role, Long userId) {
        if (role == null || (!"STUDENT".equalsIgnoreCase(role.trim()) && !"TEACHER".equalsIgnoreCase(role.trim()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied. Student/Teacher role required.");
        }
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing student identity in JWT.");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));
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
            @RequestAttribute(value = "jwtRole", required = false) String role,
            @RequestAttribute(value = "jwtStudentId", required = false) Long userId,
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
            @RequestAttribute(value = "jwtRole", required = false) String role,
            @RequestAttribute(value = "jwtStudentId", required = false) Long userId,
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
    public ResponseEntity<List<BookIssue>> getAllIssues(@RequestAttribute(value = "jwtRole", required = false) String role) {
        validateLibrarian(role);
        return ResponseEntity.ok(bookIssueRepository.findAll());
    }

    @PostMapping("/librarian/issues")
    public ResponseEntity<BookIssue> issueBookForStudent(
            @RequestAttribute(value = "jwtRole", required = false) String role,
            @RequestParam Long studentId,
            @RequestParam Long bookId) {
        validateLibrarian(role);

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found."));

        if (!"STUDENT".equalsIgnoreCase(student.getRole()) && !"TEACHER".equalsIgnoreCase(student.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User must be a student or a teacher.");
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
            @RequestAttribute(value = "jwtRole", required = false) String role,
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
            @RequestAttribute(value = "jwtRole", required = false) String role,
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
            @RequestAttribute(value = "jwtRole", required = false) String role,
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
            @RequestAttribute(value = "jwtRole", required = false) String roleHeader,
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
    public ResponseEntity<Map<String, Object>> deleteBook(
            @RequestAttribute(value = "jwtRole", required = false) String role,
            @PathVariable Long bookId) {
        validateLibrarian(role);

        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));

        // If a book is currently issued, librarian should not delete it directly
        // without issuing/returning state handling.
        // But for simplicity, we allow deleting and cleaning up any active issues if
        // they exist.
        bookRepository.delete(book);
        Map<String, Object> response = new HashMap<>();
        response.put("deleted", true);
        response.put("bookId", bookId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/librarian/books/{bookId}/availability")
    public ResponseEntity<Book> updateBookAvailability(
            @RequestAttribute(value = "jwtRole", required = false) String role,
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
    public ResponseEntity<List<User>> getAllUsers(@RequestAttribute(value = "jwtRole", required = false) String role) {
        validateLibrarian(role);
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping("/librarian/users")
    public ResponseEntity<User> createUser(
            @RequestAttribute(value = "jwtRole", required = false) String roleHeader,
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
    public ResponseEntity<Map<String, Object>> deleteUser(
            @RequestAttribute(value = "jwtRole", required = false) String roleHeader,
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
        Map<String, Object> response = new HashMap<>();
        response.put("deleted", true);
        response.put("userId", id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/students/{studentId}/fine-status")
    public ResponseEntity<FineStatusDto> getFineStatus(
            @RequestAttribute(value = "jwtRole", required = false) String role,
            @RequestAttribute(value = "jwtStudentId", required = false) Long jwtStudentId,
            @PathVariable Long studentId) {
        authorizeStudentScope(role, jwtStudentId, studentId);

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found."));

        if (!"STUDENT".equalsIgnoreCase(student.getRole()) && !"TEACHER".equalsIgnoreCase(student.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User must be a student or a teacher.");
        }

        double totalFine = calculateTotalFine(studentId, LocalDate.now());
        FineStatusDto response = new FineStatusDto(studentId, totalFine > 0.0, totalFine);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/students/{studentId}/has-active-issue")
    public ResponseEntity<ActiveIssueDto> hasActiveIssue(
            @RequestAttribute(value = "jwtRole", required = false) String role,
            @RequestAttribute(value = "jwtStudentId", required = false) Long jwtStudentId,
            @PathVariable Long studentId) {
        authorizeStudentScope(role, jwtStudentId, studentId);

        boolean hasActiveIssue = !bookIssueRepository.findByStudentIdAndReturnDateIsNull(studentId).isEmpty();
        return ResponseEntity.ok(new ActiveIssueDto(studentId, hasActiveIssue));
    }

    private void authorizeStudentScope(String role, Long jwtStudentId, Long studentId) {
        if (role == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing JWT role.");
        }
        if ("LIBRARIAN".equalsIgnoreCase(role)) {
            return;
        }
        if (!"STUDENT".equalsIgnoreCase(role) && !"TEACHER".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied.");
        }
        if (jwtStudentId == null || !jwtStudentId.equals(studentId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied for this student.");
        }
    }

    private double calculateTotalFine(Long studentId, LocalDate referenceDate) {
        List<BookIssue> activeIssues = bookIssueRepository.findByStudentIdAndReturnDateIsNull(studentId);
        double totalFine = 0.0;
        for (BookIssue issue : activeIssues) {
            if (referenceDate.isAfter(issue.getDueDate())) {
                long daysOverdue = ChronoUnit.DAYS.between(issue.getDueDate(), referenceDate);
                totalFine += daysOverdue;
            }
        }
        return totalFine;
    }
}
