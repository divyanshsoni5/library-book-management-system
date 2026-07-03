import { Component, inject, signal, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LibraryService } from '../../services/library.service';
import { UserService } from '../../services/user.service';
import { BookService } from '../../services/book.service';
import { Book, User } from '../../models/models';

@Component({
  selector: 'app-issue-book',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './issue-book.html'
})
export class IssueBookComponent {
  libraryService = inject(LibraryService);
  userService = inject(UserService);
  bookService = inject(BookService);

  @Output() tabChange = new EventEmitter<string>();

  // Form Fields
  selectedUserId = '';
  selectedBookId = '';
  issueDate = new Date().toISOString().split('T')[0]; // Default to today

  // Notification alerts
  successMessage = '';
  errorMessage = '';

  // Get active standard users (not librarians)
  availableUsers = computed(() => {
    return this.userService.users().filter(u => u.role === 'Student' || u.role === 'Teacher');
  });

  // Get books with at least 1 copy available
  availableBooks = computed(() => {
    return this.bookService.books().filter(b => b.availableCopies > 0);
  });

  /**
   * Process the form submission.
   */
  submitIssue(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.selectedUserId || !this.selectedBookId || !this.issueDate) {
      this.errorMessage = 'Please fill in all the required form fields.';
      return;
    }

    const success = this.libraryService.issueBook(
      this.selectedUserId,
      this.selectedBookId,
      this.issueDate
    );

    if (success) {
      const selectedUser = this.userService.users().find(u => u.id === this.selectedUserId);
      const selectedBook = this.bookService.books().find(b => b.id === this.selectedBookId);
      
      this.successMessage = `Successfully issued "${selectedBook?.title}" to "${selectedUser?.name}".`;
      
      // Reset form options
      this.selectedUserId = '';
      this.selectedBookId = '';
      this.issueDate = new Date().toISOString().split('T')[0];

      // Auto redirect to returns tab after 2.5 seconds to see the issued log
      setTimeout(() => {
        this.tabChange.emit('return');
      }, 2500);
    } else {
      this.errorMessage = 'Failed to issue the book. Verify if copies are available.';
    }
  }
}
