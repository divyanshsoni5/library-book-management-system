package com.librarymanagement.library_management.controller;

import com.librarymanagement.library_management.model.Book;
import com.librarymanagement.library_management.model.User;
import com.librarymanagement.library_management.repository.BookIssueRepository;
import com.librarymanagement.library_management.repository.BookRepository;
import com.librarymanagement.library_management.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
public class LibraryControllerTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private BookIssueRepository bookIssueRepository;

    private User student;
    private User librarian;
    private Book availableBook;
    private Book issuedBook;

    @BeforeEach
    public void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(this.webApplicationContext).build();

        bookIssueRepository.deleteAll();
        bookRepository.deleteAll();
        userRepository.deleteAll();

        student = userRepository.save(new User("teststudent", "STUDENT"));
        librarian = userRepository.save(new User("testlibrarian", "LIBRARIAN"));

        availableBook = bookRepository.save(new Book("Available Book", "Author A", "1111111111"));
        
        issuedBook = new Book("Issued Book", "Author B", "2222222222");
        issuedBook.setAvailable(false);
        issuedBook.setTag("ISSUED");
        issuedBook = bookRepository.save(issuedBook);
    }

    @Test
    public void testStudentGetBooks_NoSearch() throws Exception {
        mockMvc.perform(get("/api/student/books")
                .header("X-User-Role", "STUDENT")
                .header("X-User-Id", student.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    public void testStudentGetBooks_WithSearch() throws Exception {
        mockMvc.perform(get("/api/student/books")
                .header("X-User-Role", "STUDENT")
                .header("X-User-Id", student.getId())
                .param("search", "Available"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title", is("Available Book")));
    }

    @Test
    public void testLibrarianIssueAndReturnBook_Success() throws Exception {
        // Librarian issues book to student
        mockMvc.perform(post("/api/librarian/issues")
                .header("X-User-Role", "LIBRARIAN")
                .param("studentId", student.getId().toString())
                .param("bookId", availableBook.getId().toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bookId", is(availableBook.getId().intValue())))
                .andExpect(jsonPath("$.studentId", is(student.getId().intValue())));

        // Verify book tag is now ISSUED
        mockMvc.perform(get("/api/student/books")
                .header("X-User-Role", "STUDENT")
                .header("X-User-Id", student.getId())
                .param("search", "1111111111"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].available", is(false)))
                .andExpect(jsonPath("$[0].tag", is("ISSUED")));

        // Librarian processes return for student
        mockMvc.perform(post("/api/librarian/returns")
                .header("X-User-Role", "LIBRARIAN")
                .param("studentId", student.getId().toString())
                .param("bookId", availableBook.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", is("Book returned successfully")))
                .andExpect(jsonPath("$.fineAmount", is(0.0)));
    }

    @Test
    public void testStudentDashboard_FineCalculation() throws Exception {
        // Librarian issues the available book to student first
        mockMvc.perform(post("/api/librarian/issues")
                .header("X-User-Role", "LIBRARIAN")
                .param("studentId", student.getId().toString())
                .param("bookId", availableBook.getId().toString()))
                .andExpect(status().isCreated());

        // Check dashboard on default date (today) -> fine should be 0
        mockMvc.perform(get("/api/student/dashboard")
                .header("X-User-Role", "STUDENT")
                .header("X-User-Id", student.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.booksIssuedCount", is(1)))
                .andExpect(jsonPath("$.totalFine", is(0.0)));

        // Check dashboard with simulated date (40 days from now, which is 10 days past the 30-day limit) -> fine should be 10.0
        LocalDate simulatedDate = LocalDate.now().plusDays(40);
        mockMvc.perform(get("/api/student/dashboard")
                .header("X-User-Role", "STUDENT")
                .header("X-User-Id", student.getId())
                .param("simulatedDate", simulatedDate.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.booksIssuedCount", is(1)))
                .andExpect(jsonPath("$.totalFine", is(10.0)))
                .andExpect(jsonPath("$.issuedBooks[0].daysOverdue", is(10)))
                .andExpect(jsonPath("$.issuedBooks[0].fine", is(10.0)));
    }

    @Test
    public void testStudentAccessRestrictions() throws Exception {
        // Students trying to call librarian issue endpoint should get 403 Forbidden
        mockMvc.perform(post("/api/librarian/issues")
                .header("X-User-Role", "STUDENT")
                .header("X-User-Id", student.getId())
                .param("studentId", student.getId().toString())
                .param("bookId", availableBook.getId().toString()))
                .andExpect(status().isForbidden());

        // Students trying to call librarian return endpoint should get 403 Forbidden
        mockMvc.perform(post("/api/librarian/returns")
                .header("X-User-Role", "STUDENT")
                .header("X-User-Id", student.getId())
                .param("studentId", student.getId().toString())
                .param("bookId", availableBook.getId().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    public void testLibrarianAddBook() throws Exception {
        String newBookJson = "{\"title\":\"New Book\",\"author\":\"Author C\",\"isbn\":\"3333333333\"}";
        
        mockMvc.perform(post("/api/librarian/books")
                .header("X-User-Role", "LIBRARIAN")
                .contentType(MediaType.APPLICATION_JSON)
                .content(newBookJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title", is("New Book")))
                .andExpect(jsonPath("$.available", is(true)))
                .andExpect(jsonPath("$.tag", is("AVAILABLE")));
    }

    @Test
    public void testLibrarianDeleteBook() throws Exception {
        mockMvc.perform(delete("/api/librarian/books/" + availableBook.getId())
                .header("X-User-Role", "LIBRARIAN"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/student/books")
                .header("X-User-Role", "STUDENT")
                .header("X-User-Id", student.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1))); // only the issued book remains
    }

    @Test
    public void testLibrarianUpdateAvailability() throws Exception {
        mockMvc.perform(put("/api/librarian/books/" + availableBook.getId() + "/availability")
                .header("X-User-Role", "LIBRARIAN")
                .param("available", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available", is(false)))
                .andExpect(jsonPath("$.tag", is("UNAVAILABLE")));
    }
}
