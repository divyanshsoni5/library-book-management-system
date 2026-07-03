import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LibraryService } from '../../services/library.service';
import { UserService } from '../../services/user.service';
import { BookService } from '../../services/book.service';
import { IssuedBook } from '../../models/models';

@Component({
  selector: 'app-my-books',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-books.html'
})
export class MyBooksComponent {
  libraryService = inject(LibraryService);
  userService = inject(UserService);
  bookService = inject(BookService);

  // Computed list of issued books for the logged-in user
  myIssuedBooks = computed(() => {
    const user = this.userService.currentUser();
    if (!user) return [];
    
    // Retrieve issued books for user
    const userIssues = this.libraryService.issuedBooks().filter(
      ib => ib.userId === user.id && !ib.returnDate
    );
    
    return userIssues;
  });

  /**
   * Helper to look up a book title by its ID.
   */
  getBookTitle(bookId: string): string {
    const book = this.bookService.books().find(b => b.id === bookId);
    return book ? book.title : 'Unknown Book';
  }

  /**
   * Helper to look up a book author by its ID.
   */
  getBookAuthor(bookId: string): string {
    const book = this.bookService.books().find(b => b.id === bookId);
    return book ? book.author : 'Unknown Author';
  }

  /**
   * Calculate fine dynamically for an active issue record.
   */
  getFine(issueDate: string): number {
    return this.libraryService.calculateFine(issueDate);
  }
}
