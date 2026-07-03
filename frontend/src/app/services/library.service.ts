import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BookService } from './book.service';
import { UserService } from './user.service';
import { IssuedBook } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class LibraryService {
  private bookService = inject(BookService);
  private userService = inject(UserService);
  private http = inject(HttpClient);

  // Writable signal for issued books
  private issuedBooksSignal = signal<IssuedBook[]>([]);
  issuedBooks = this.issuedBooksSignal.asReadonly();

  // Dynamic computed statistics for Librarian header dashboard
  totalBooks = computed(() => {
    return this.bookService.books().reduce((sum, b) => sum + b.quantity, 0);
  });

  availableBooks = computed(() => {
    return this.bookService.books().reduce((sum, b) => sum + b.availableCopies, 0);
  });

  issuedBooksCount = computed(() => {
    return this.bookService.books().reduce((sum, b) => sum + (b.quantity - b.availableCopies), 0);
  });

  constructor() {
    // Automatically load data when user logs in/out
    effect(() => {
      const user = this.userService.currentUser();
      if (user) {
        this.refreshIssuedBooks();
      } else {
        this.issuedBooksSignal.set([]);
      }
    });
  }

  /**
   * Refresh the list of issued books. 
   * If a student is logged in, fetches from student dashboard.
   * If a librarian is logged in, fetches all issues.
   */
  refreshIssuedBooks(): void {
    const user = this.userService.currentUser();
    if (!user) return;

    if (user.role.toUpperCase() === 'STUDENT') {
      this.refreshDashboard();
    } else {
      this.refreshLibrarianIssues();
    }
  }

  /**
   * Fetch active issues and fines for student from the backend dashboard API.
   */
  private refreshDashboard(): void {
    const user = this.userService.currentUser();
    if (!user) return;

    const headers = {
      'X-User-Role': 'STUDENT',
      'X-User-Id': user.id
    };

    this.http.get<any>('/api/student/dashboard', { headers }).subscribe({
      next: (dashboard) => {
        if (dashboard && dashboard.issuedBooks) {
          const mappedIssues: IssuedBook[] = dashboard.issuedBooks.map((item: any) => ({
            id: `issue-${item.bookId}-${item.issueDate}`,
            userId: user.id,
            bookId: String(item.bookId),
            issueDate: item.issueDate,
            dueDate: item.dueDate,
            finePaid: item.fine === 0,
            fineAmount: item.fine
          }));
          this.issuedBooksSignal.set(mappedIssues);
        }
      },
      error: (err) => {
        console.error('Failed to load student dashboard from backend', err);
      }
    });
  }

  /**
   * Fetch all global issues from the backend (for Librarian view).
   */
  private refreshLibrarianIssues(): void {
    const headers = {
      'X-User-Role': 'LIBRARIAN'
    };

    this.http.get<any[]>('/api/librarian/issues', { headers }).subscribe({
      next: (data) => {
        const mappedIssues: IssuedBook[] = data.map(ib => ({
          id: String(ib.id),
          userId: String(ib.studentId),
          bookId: String(ib.bookId),
          issueDate: ib.issueDate,
          dueDate: ib.dueDate,
          returnDate: ib.returnDate || undefined,
          finePaid: ib.returnDate ? true : false,
          fineAmount: 0 // To be dynamically calculated or provided by backend
        }));
        this.issuedBooksSignal.set(mappedIssues);
      },
      error: (err) => {
        console.warn('Failed to load global issued books from backend /api/librarian/issues. Using empty local state until endpoint is ready.', err);
        this.issuedBooksSignal.set([]);
      }
    });
  }

  /**
   * Calculate fine based on rules:
   * - <= 30 days kept: 0 rs
   * - 31 to 90 days kept: 1 rs per day
   * - > 90 days kept: 60 rs + 5 rs per day for days exceeding 90 days
   */
  calculateFine(issueDateStr: string, returnDateStr?: string): number {
    const issueDate = new Date(issueDateStr);
    const endDate = returnDateStr ? new Date(returnDateStr) : new Date();
    
    issueDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    
    const diffTime = endDate.getTime() - issueDate.getTime();
    if (diffTime < 0) return 0;
    
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 30) {
      return 0;
    } else if (diffDays <= 90) {
      return (diffDays - 30) * 1;
    } else {
      return 60 + (diffDays - 90) * 5;
    }
  }

  /**
   * Get active issued books (not returned yet)
   */
  getActiveIssuedBooks() {
    return computed(() => {
      return this.issuedBooks().filter(ib => !ib.returnDate);
    });
  }

  /**
   * Get currently issued books for a specific user.
   */
  getIssuedBooksForUser(userId: string) {
    return computed(() => {
      return this.issuedBooks().filter(ib => ib.userId === userId && !ib.returnDate);
    });
  }

  /**
   * Issue a book to a user via the backend REST API.
   */
  issueBook(userId: string, bookId: string, issueDateStr: string): boolean {
    const headers = {
      'X-User-Role': 'LIBRARIAN'
    };

    this.http.post<any>('/api/librarian/issues', null, {
      headers,
      params: {
        studentId: userId,
        bookId: bookId
      }
    }).subscribe({
      next: (res) => {
        console.log('Book issued successfully in backend database', res);
        this.bookService.refreshBooks();
        this.refreshIssuedBooks();
      },
      error: (err) => {
        console.error('Failed to issue book in backend database', err);
      }
    });

    return true;
  }

  /**
   * Return an issued book via the backend REST API.
   */
  returnBook(issueId: string, collectFine: boolean): boolean {
    const record = this.issuedBooks().find(r => r.id === issueId);
    
    if (record && !record.returnDate) {
      const headers = {
        'X-User-Role': 'LIBRARIAN'
      };

      this.http.post<any>('/api/librarian/returns', null, {
        headers,
        params: {
          studentId: record.userId,
          bookId: record.bookId
        }
      }).subscribe({
        next: (res) => {
          console.log('Book returned successfully in backend database', res);
          this.bookService.refreshBooks();
          this.refreshIssuedBooks();
        },
        error: (err) => {
          console.error('Failed to return book in backend database', err);
        }
      });
      return true;
    }
    
    return false;
  }
}
