import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, map, switchMap } from 'rxjs/operators';
import { of, Observable, throwError } from 'rxjs';
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
   * Students/Faculty use /api/student/books (with STUDENT headers).
   */
  getBooksObservable(): Observable<Book[]> {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return of([]);

    const isLibrarian = currentUser.role === 'Librarian';

    const headers = new HttpHeaders()
      .set('X-User-Role', currentUser.role.toUpperCase())
      .set('X-User-Id', currentUser.id);

    const url = isLibrarian ? '/api/librarian/books' : '/api/student/books';

    return this.http.get<any[]>(url, { headers }).pipe(
      map(books => books.map(b => this.mapBackendBook(b))),
      catchError(err => {
        console.error('Failed to load books from backend REST API', err);
        return of([]);
      })
    );
  }

  /**
   * Students/Faculty use /api/student/books (with STUDENT headers).
   */
  refreshBooks(): void {
    this.getBooksObservable().subscribe(books => {
      this.booksSignal.set(books);
    });
  }

  /**
   * Add a new book to the library via the backend.
   */
  addBook(bookData: Omit<Book, 'id' | 'availableCopies'>): Observable<Book[]> {
    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN')
      .set('X-User-Id', this.userService.currentUser()?.id || '');

    const body = {
      title: bookData.title,
      author: bookData.author,
      isbn: bookData.isbn,
      category: bookData.category,
      quantity: bookData.quantity
    };

    return this.http.post<any>('/api/librarian/books', body, { headers }).pipe(
      switchMap(() => this.getBooksObservable()),
      map(books => {
        this.booksSignal.set(books);
        return books;
      }),
      catchError(err => {
        console.error('Failed to add book via backend', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Update a book's general details.
   */
  updateBook(updatedBook: Book): Observable<Book[]> {
    const headers = new HttpHeaders()
      .set('X-User-Role', 'LIBRARIAN')
      .set('X-User-Id', this.userService.currentUser()?.id || '');

    return this.http.put<any>(`/api/librarian/books/${updatedBook.id}`, updatedBook, { headers }).pipe(
      switchMap(() => this.getBooksObservable()),
      map(books => {
        this.booksSignal.set(books);
        return books;
      }),
      catchError(err => {
        console.error('Failed to update book via backend', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Delete a book from the backend.
   */
  deleteBook(id: string): Observable<Book[]> {
    const headers = new HttpHeaders().set('X-User-Role', 'LIBRARIAN');

    return this.http.delete<void>(`/api/librarian/books/${id}`, { headers }).pipe(
      switchMap(() => this.getBooksObservable()),
      map(books => {
        this.booksSignal.set(books);
        return books;
      }),
      catchError(err => {
        console.error('Failed to delete book via backend', err);
        return throwError(() => err);
      })
    );
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
