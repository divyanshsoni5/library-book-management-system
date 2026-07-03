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
        // Clear existing database records
        bookIssueRepository.deleteAll();
        bookRepository.deleteAll();
        userRepository.deleteAll();

        // 1. Create Users
        User librarian = userRepository.save(new User("librarian1", "LIBRARIAN"));
        User student1 = userRepository.save(new User("student1", "STUDENT"));
        User student2 = userRepository.save(new User("student2", "STUDENT"));

        // 2. Create Books
        Book book1 = bookRepository.save(new Book("The Great Gatsby", "F. Scott Fitzgerald", "9780743273565"));
        Book book2 = bookRepository.save(new Book("To Kill a Mockingbird", "Harper Lee", "9780061120084"));

        // Create an issued book
        Book book3 = new Book("1984", "George Orwell", "9780451524935");
        book3.setAvailable(false);
        book3.setTag("ISSUED");
        book3 = bookRepository.save(book3);

        // Create an unavailable book (marked by librarian)
        Book book4 = new Book("Brave New World", "Aldous Huxley", "9780060850524");
        book4.setAvailable(false);
        book4.setTag("UNAVAILABLE");
        book4 = bookRepository.save(book4);

        // 3. Create active issues
        // Issue book3 to student1, issued 20 days ago (due date was 6 days ago,
        // resulting in a 6 rupee fine)
        LocalDate issueDate = LocalDate.now().minusDays(20);
        LocalDate dueDate = issueDate.plusDays(14);
        BookIssue issue = new BookIssue(book3.getId(), student1.getId(), issueDate, dueDate);
        bookIssueRepository.save(issue);
    }
}
