import { Component, inject, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LibraryService } from '../../services/library.service';
import { UserService } from '../../services/user.service';
import { BookService } from '../../services/book.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html'
})
export class DashboardComponent {
  libraryService = inject(LibraryService);
  userService = inject(UserService);
  bookService = inject(BookService);

  @Output() tabChange = new EventEmitter<string>();
  @Output() addBookTriggered = new EventEmitter<void>();

  // Statistics
  currentUser = this.userService.currentUser;

  totalBooksCount = this.libraryService.totalBooks;
  availableBooksCount = this.libraryService.availableBooks;
  issuedBooksCount = this.libraryService.issuedBooksCount;

  // Active Users count
  totalUsersCount = computed(() => this.userService.users().length);

  // Overdue Books (due date passed and not returned)
  overdueBooksCount = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.libraryService.issuedBooks().filter(ib => !ib.returnDate && ib.dueDate < today).length;
  });

  // User-specific Stats
  myBorrowedCount = computed(() => {
    const user = this.currentUser();
    if (!user) return 0;
    return this.libraryService.issuedBooks().filter(ib => ib.userId === user.id && !ib.returnDate).length;
  });

  myOverdueCount = computed(() => {
    const user = this.currentUser();
    if (!user) return 0;
    const today = new Date().toISOString().split('T')[0];
    return this.libraryService.issuedBooks().filter(ib => ib.userId === user.id && !ib.returnDate && ib.dueDate < today).length;
  });

  // Recent activity logs
  recentActivities = computed(() => {
    const issues = this.libraryService.issuedBooks();
    // Sort issues in reverse order
    const sorted = [...issues].sort((a, b) => b.id.localeCompare(a.id));
    return sorted.slice(0, 5).map(act => {
      const book = this.bookService.books().find(b => b.id === act.bookId);
      const user = this.userService.users().find(u => u.id === act.userId);
      return {
        ...act,
        bookTitle: book ? book.title : 'Unknown Book',
        userName: user ? user.name : 'Unknown User',
        userRole: user ? user.role : 'User'
      };
    });
  });

  // User-specific recent activity
  myRecentActivities = computed(() => {
    const user = this.currentUser();
    if (!user) return [];
    const issues = this.libraryService.issuedBooks().filter(ib => ib.userId === user.id);
    const sorted = [...issues].sort((a, b) => b.id.localeCompare(a.id));
    return sorted.slice(0, 5).map(act => {
      const book = this.bookService.books().find(b => b.id === act.bookId);
      return {
        ...act,
        bookTitle: book ? book.title : 'Unknown Book'
      };
    });
  });

  quickAction(tab: string): void {
    if (tab === 'add-book') {
      this.addBookTriggered.emit();
    } else {
      this.tabChange.emit(tab);
    }
  }
}
