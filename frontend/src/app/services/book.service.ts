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

  private booksSignal = signal<Book[]>([]);
  books = this.booksSignal.asReadonly();

  constructor() {
    // Automatically fetch books when the current user changes (e.g. login)
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
      id: `${backendBook.id}`,
      title: backendBook.title,
      author: backendBook.author,
      category: 'General',
      isbn: backendBook.isbn,
      quantity: 1,
      availableCopies: backendBook.available ? 1 : 0
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
        console.error('Failed to fetch books', err);
        return of([]);
      })
    ).subscribe(books => {
      this.booksSignal.set(books);
    });
  }

  /**
   * Add a new book.
   */
  addBook(bookData: Omit<Book, 'id' | 'availableCopies'>): void {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;

    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN');

    const body = {
      title: bookData.title,
      author: bookData.author,
      isbn: bookData.isbn
    };

    this.http.post<any>('/api/librarian/books', body, { headers }).subscribe({
      next: () => this.refreshBooks(),
      error: err => console.error('Failed to add book', err)
    });
  }

  /**
   * Update an existing book's availability.
   */
  updateBook(updatedBook: Book): void {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;

    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN');

    const params = new HttpParams()
      .set('available', updatedBook.availableCopies > 0 ? 'true' : 'false');

    this.http.put<any>(`/api/librarian/books/${updatedBook.id}/availability`, null, { headers, params }).subscribe({
      next: () => this.refreshBooks(),
      error: err => console.error('Failed to update book availability', err)
    });
  }

  /**
   * Delete a book.
   */
  deleteBook(id: string): void {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;

    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN');

    this.http.delete<void>(`/api/librarian/books/${id}`, { headers }).subscribe({
      next: () => this.refreshBooks(),
      error: err => console.error('Failed to delete book', err)
    });
  }

  /**
   * Helper (kept for compatibility, though backend updates availability directly).
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
