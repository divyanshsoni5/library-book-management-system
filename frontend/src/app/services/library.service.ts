import { Injectable, signal, computed, inject } from '@angular/core';
import { BookService } from './book.service';
import { UserService } from './user.service';
import { IssuedBook } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class LibraryService {
  private readonly STORAGE_KEY = 'lms_issued_books';
  
  private bookService = inject(BookService);
  private userService = inject(UserService);

  // Default mock issued books
  // Given today is 2026-07-03:
  // 1. book-1 (The Great Gatsby) issued to user-1 (Aarav Sharma) on 2026-06-25 (8 days ago) -> fine: 0 rs
  // 2. book-2 (To Kill a Mockingbird) issued to user-2 (Priya Patel) on 2026-05-15 (49 days ago) -> fine: 19 rs (49 - 30)
  // 3. book-3 (A Brief History of Time) issued to user-1 (Aarav Sharma) on 2026-03-01 (124 days ago) -> fine: 230 rs (60 + 34 * 5)
  private readonly defaultIssuedBooks: IssuedBook[] = [
    {
      id: 'issue-1',
      userId: 'user-1',
      bookId: 'book-1',
      issueDate: '2026-06-25',
      dueDate: '2026-07-25',
      finePaid: false,
      fineAmount: 0
    },
    {
      id: 'issue-2',
      userId: 'user-2',
      bookId: 'book-2',
      issueDate: '2026-05-15',
      dueDate: '2026-06-15',
      finePaid: false,
      fineAmount: 0
    },
    {
      id: 'issue-3',
      userId: 'user-1',
      bookId: 'book-3',
      issueDate: '2026-03-01',
      dueDate: '2026-04-01',
      finePaid: false,
      fineAmount: 0
    }
  ];

  // Writable signal for issued books
  private issuedBooksSignal = signal<IssuedBook[]>(this.loadIssuedBooks());
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

  constructor() {}

  /**
   * Load issued books from localStorage or use default mock data.
   */
  private loadIssuedBooks(): IssuedBook[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse issued books', e);
      }
    }
    // Initialize defaults in localStorage
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.defaultIssuedBooks));
    return this.defaultIssuedBooks;
  }

  /**
   * Save current issued books signal value to localStorage.
   */
  private saveIssuedBooks(records: IssuedBook[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
    this.issuedBooksSignal.set(records);
  }

  /**
   * Calculate fine based on rules:
   * - <= 30 days kept: 0 rs
   * - 31 to 90 days kept: 1 rs per day
   * - > 90 days kept: 60 rs + 5 rs per day for days exceeding 90 days
   */
  calculateFine(issueDateStr: string, returnDateStr?: string): number {
    const issueDate = new Date(issueDateStr);
    
    // Use target return date or today's date if not returned yet
    const endDate = returnDateStr ? new Date(returnDateStr) : new Date();
    
    // Clear time parts for accurate day calculations
    issueDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    
    const diffTime = endDate.getTime() - issueDate.getTime();
    if (diffTime < 0) return 0; // Guard against date issues
    
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
   * Issue a book to a user.
   */
  issueBook(userId: string, bookId: string, issueDateStr: string): boolean {
    const book = this.bookService.books().find(b => b.id === bookId);
    
    if (!book || book.availableCopies <= 0) {
      return false; // Book not available
    }

    // Calculate due date (default: 1 month after issue date)
    const issueDate = new Date(issueDateStr);
    const dueDate = new Date(issueDate);
    dueDate.setMonth(issueDate.getMonth() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const newIssue: IssuedBook = {
      id: `issue-${Date.now()}`,
      userId,
      bookId,
      issueDate: issueDateStr,
      dueDate: dueDateStr,
      finePaid: false,
      fineAmount: 0
    };

    // Decrement available copies in book service
    const success = this.bookService.updateAvailableCopies(bookId, -1);
    
    if (success) {
      const updated = [...this.issuedBooksSignal(), newIssue];
      this.saveIssuedBooks(updated);
      return true;
    }
    
    return false;
  }

  /**
   * Return an issued book and record fine collection if applicable.
   */
  returnBook(issueId: string, collectFine: boolean): boolean {
    const records = this.issuedBooksSignal();
    const index = records.findIndex(r => r.id === issueId);
    
    if (index !== -1 && !records[index].returnDate) {
      const record = records[index];
      const todayStr = new Date().toISOString().split('T')[0];
      const calculatedFine = this.calculateFine(record.issueDate, todayStr);
      
      const updatedRecord: IssuedBook = {
        ...record,
        returnDate: todayStr,
        finePaid: collectFine ? true : (calculatedFine === 0),
        fineAmount: calculatedFine
      };

      // Increment available copies in book service
      const success = this.bookService.updateAvailableCopies(record.bookId, 1);
      
      if (success) {
        const updated = [...records];
        updated[index] = updatedRecord;
        this.saveIssuedBooks(updated);
        return true;
      }
    }
    
    return false;
  }
}
