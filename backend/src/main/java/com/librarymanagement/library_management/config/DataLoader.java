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
        if (bookRepository.count() > 0) {
            return;
        }

        // Seed default books
        Book book1 = new Book("Introduction to Algorithms", "Thomas H. Cormen", "9780262033848", "Computer Science", 3);
        book1 = bookRepository.save(book1);

        Book book2 = new Book("Clean Code", "Robert C. Martin", "9780132350884", "Programming", 5);
        bookRepository.save(book2);

        Book book3 = new Book("Design Patterns", "Erich Gamma", "9780201633610", "Software Engineering", 4);
        bookRepository.save(book3);

        Book book4 = new Book("The Pragmatic Programmer", "Andrew Hunt", "9780135957059", "Programming", 2);
        bookRepository.save(book4);
    }
}
