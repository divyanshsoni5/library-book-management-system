package com.librarymanagement.library_management.config;

import com.librarymanagement.library_management.model.Book;
import com.librarymanagement.library_management.model.BookIssue;
import com.librarymanagement.library_management.model.User;
import com.librarymanagement.library_management.repository.BookIssueRepository;
import com.librarymanagement.library_management.repository.BookRepository;
import com.librarymanagement.library_management.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.time.LocalDate;

@Component
public class DataLoader implements CommandLineRunner {

    private final UserRepository userRepository;
    private final BookRepository bookRepository;
    private final BookIssueRepository bookIssueRepository;

    public DataLoader(UserRepository userRepository,
                      BookRepository bookRepository,
                      BookIssueRepository bookIssueRepository) {
        this.userRepository = userRepository;
        this.bookRepository = bookRepository;
        this.bookIssueRepository = bookIssueRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        // Check if database is already populated
        if (userRepository.count() > 0 || bookRepository.count() > 0) {
            return;
        }

        // Seed ONLY 1 librarian
        User librarian = new User("librarian1", "LIBRARIAN", "Librarian", "librarian1@sgsits.ac.in");
        userRepository.save(librarian);

        // Seed default student to match UI demo credentials
        User student = new User("0801CS241037", "STUDENT", "Student Test", "0801cs241037@sgsits.ac.in");
        userRepository.save(student);

        // Seed default student Divyansh Soni (0801CS241055)
        User divyansh = new User("0801CS241055", "STUDENT", "Divyansh Soni", "0801cs241055@sgsits.ac.in");
        divyansh = userRepository.save(divyansh);

        // Seed default teacher to match UI demo credentials
        User teacher = new User("rajesh_kumar@sgsits.ac.in", "FACULTY", "Rajesh Kumar", "rajesh_kumar@sgsits.ac.in");
        userRepository.save(teacher);

        // Seed default books
        Book book1 = new Book("Introduction to Algorithms", "Thomas H. Cormen", "9780262033848", "Computer Science", 3);
        book1.setAvailableCopies(2); // 1 copy issued below
        book1 = bookRepository.save(book1);

        Book book2 = new Book("Clean Code", "Robert C. Martin", "9780132350884", "Programming", 5);
        bookRepository.save(book2);

        Book book3 = new Book("Design Patterns", "Erich Gamma", "9780201633610", "Software Engineering", 4);
        bookRepository.save(book3);

        Book book4 = new Book("The Pragmatic Programmer", "Andrew Hunt", "9780135957059", "Programming", 2);
        bookRepository.save(book4);

        // Seed active book issue for Divyansh Soni issued 3 months ago
        LocalDate issueDate = LocalDate.now().minusMonths(3);
        LocalDate dueDate = issueDate.plusDays(30); // 30 days due date policy
        BookIssue issue = new BookIssue(book1.getId(), divyansh.getId(), issueDate, dueDate);
        bookIssueRepository.save(issue);
    }
}
