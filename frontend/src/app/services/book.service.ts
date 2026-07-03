import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { Book } from '../models/models';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class BookService {
  private http = inject(HttpClient);
  private userService = inject(UserService);

  // Writable signal holding the state of books
  private booksSignal = signal<Book[]>([]);

  // Exposed read-only signal for components to consume
  books = this.booksSignal.asReadonly();

  constructor() {
    // Automatically refresh book list whenever the current logged-in user changes
    effect(() => {
      const user = this.userService.currentUser();
      if (user) {
        this.refreshBooks();
      } else {
        this.booksSignal.set([]);
      }
    }, { allowSignalWrites: true });
  }

  private mapBackendBook(backendBook: any): Book {
    return {
      id: String(backendBook.id),
      title: backendBook.title,
      author: backendBook.author,
      category: backendBook.category || 'General',
      isbn: backendBook.isbn,
      quantity: backendBook.quantity !== undefined ? backendBook.quantity : 1,
      availableCopies: backendBook.availableCopies !== undefined
        ? backendBook.availableCopies
        : (backendBook.available ? 1 : 0)
    };
  }

  /**
   * Load books from the backend.
   * Librarians use the dedicated /api/librarian/books endpoint (with LIBRARIAN headers).
   * Students/Teachers use /api/student/books (with STUDENT headers).
   */
  refreshBooks(): void {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;

    const isLibrarian = currentUser.role === 'Librarian';

    const headers = new HttpHeaders()
      .set('X-User-Role', isLibrarian ? 'LIBRARIAN' : 'STUDENT')
      .set('X-User-Id', currentUser.id);

    const url = isLibrarian ? '/api/librarian/books' : '/api/student/books';

    this.http.get<any[]>(url, { headers }).pipe(
      map(books => books.map(b => this.mapBackendBook(b))),
      catchError(err => {
        console.error('Failed to load books from backend REST API', err);
        return of([]);
      })
    ).subscribe(books => {
      this.booksSignal.set(books);
    });
  }

  /**
   * Add a new book to the library via the backend.
   */
  addBook(bookData: Omit<Book, 'id' | 'availableCopies'>): void {
    const headers = new HttpHeaders().set('X-User-Role', 'LIBRARIAN');

    const body = {
      title: bookData.title,
      author: bookData.author,
      isbn: bookData.isbn
    };

    this.http.post<any>('/api/librarian/books', body, { headers }).subscribe({
      next: () => this.refreshBooks(),
      error: err => console.error('Failed to add book via backend', err)
    });
  }

  /**
   * Update a book's availability status.
   */
  updateBook(updatedBook: Book): void {
    const headers = new HttpHeaders().set('X-User-Role', 'LIBRARIAN');
    const isAvailable = updatedBook.availableCopies > 0;

    const params = new HttpParams().set('available', String(isAvailable));

    this.http.put<any>(`/api/librarian/books/${updatedBook.id}/availability`, null, { headers, params }).subscribe({
      next: () => this.refreshBooks(),
      error: err => console.error('Failed to update book availability via backend', err)
    });
  }

  /**
   * Delete a book from the backend.
   */
  deleteBook(id: string): void {
    const headers = new HttpHeaders().set('X-User-Role', 'LIBRARIAN');

    this.http.delete<void>(`/api/librarian/books/${id}`, { headers }).subscribe({
      next: () => this.refreshBooks(),
      error: err => console.error('Failed to delete book via backend', err)
    });
  }

  /**
   * Triggered when a book transaction is completed — refreshes the book list.
   */
  updateAvailableCopies(id: string, change: number): boolean {
    const currentBooks = this.booksSignal();
    const book = currentBooks.find(b => b.id === id);
    if (book) {
      this.updateBook({
        ...book,
        availableCopies: Math.max(0, book.availableCopies + change)
      });
      return true;
    }
    return false;
  }
}
