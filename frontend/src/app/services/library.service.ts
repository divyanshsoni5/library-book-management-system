import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { BookService } from './book.service';
import { UserService } from './user.service';
import { IssuedBook } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class LibraryService {
  private http = inject(HttpClient);
  private bookService = inject(BookService);
  private userService = inject(UserService);

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
    // Automatically load issue records when the user changes
    effect(() => {
      const user = this.userService.currentUser();
      if (user) {
        this.refreshIssuedBooks();
      } else {
        this.issuedBooksSignal.set([]);
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Fetch active / past issued records from backend.
   */
  refreshIssuedBooks(): void {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;

    const headers = new HttpHeaders()
      .set('X-User-Role', currentUser.role === 'Librarian' ? 'LIBRARIAN' : 'STUDENT')
      .set('X-User-Id', currentUser.id);

    if (currentUser.role === 'Librarian') {
      this.http.get<any[]>('/api/librarian/issues', { headers }).pipe(
        map(issues => issues.map(issue => ({
          id: `issue-${issue.id}`,
          userId: `${issue.studentId}`,
          bookId: `${issue.bookId}`,
          issueDate: issue.issueDate,
          dueDate: issue.dueDate,
          returnDate: issue.returnDate || undefined,
          finePaid: issue.returnDate ? true : false,
          fineAmount: 0 // calculated in frontend or returned
        }))),
        catchError(err => {
          console.error('Failed to load librarian issues', err);
          return of([]);
        })
      ).subscribe(mappedIssues => {
        this.issuedBooksSignal.set(mappedIssues);
      });
    } else {
      // Student dashboard returns DTO with list of active issued books
      this.http.get<any>('/api/student/dashboard', { headers }).pipe(
        map(dto => {
          if (!dto || !dto.issuedBooks) return [];
          return dto.issuedBooks.map((detail: any) => ({
            id: `issue-student-${detail.bookId}`,
            userId: currentUser.id,
            bookId: `${detail.bookId}`,
            issueDate: detail.issueDate,
            dueDate: detail.dueDate,
            returnDate: undefined,
            finePaid: false,
            fineAmount: detail.fine
          }));
        }),
        catchError(err => {
          console.error('Failed to load student issues', err);
          return of([]);
        })
      ).subscribe(mappedIssues => {
        this.issuedBooksSignal.set(mappedIssues);
      });
    }
  }

  /**
   * Calculate fine based on rules.
   */
  calculateFine(issueDateStr: string, returnDateStr?: string): number {
    const issueDate = new Date(issueDateStr);
    const endDate = returnDateStr ? new Date(returnDateStr) : new Date();
    issueDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - issueDate.getTime();
    if (diffTime < 0) return 0;

    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    // Since backend uses simple rule: 1 rupee per day after due date (which is 14 days after issue date)
    const overdueDays = diffDays - 14;
    return overdueDays > 0 ? overdueDays * 1.0 : 0;
  }

  /**
   * Get active issued books.
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
   * Issue a book to a user.
   */
  issueBook(userId: string, bookId: string, issueDateStr: string): Observable<boolean> {
    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN');

    const params = new HttpParams()
      .set('studentId', userId)
      .set('bookId', bookId);

    return this.http.post<any>('/api/librarian/issues', null, { headers, params }).pipe(
      map(res => {
        if (res && res.id) {
          this.refreshIssuedBooks();
          this.bookService.refreshBooks();
          return true;
        }
        return false;
      }),
      catchError(err => {
        console.error('Failed to issue book', err);
        return of(false);
      })
    );
  }

  /**
   * Return an issued book and record fine collection if applicable.
   */
  returnBook(record: IssuedBook, collectFine: boolean): Observable<boolean> {
    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN');

    const params = new HttpParams()
      .set('studentId', record.userId)
      .set('bookId', record.bookId);

    return this.http.post<any>('/api/librarian/returns', null, { headers, params }).pipe(
      map(res => {
        if (res && res.bookId) {
          this.refreshIssuedBooks();
          this.bookService.refreshBooks();
          return true;
        }
        return false;
      }),
      catchError(err => {
        console.error('Failed to return book', err);
        return of(false);
      })
    );
  }
}
