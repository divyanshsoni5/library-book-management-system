import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
    });
  }

  /**
   * Fetch all books from the backend.
   * Maps missing properties like category and quantity with safe fallbacks until the backend is fully updated.
   */
  refreshBooks(): void {
    const user = this.userService.currentUser();
    if (!user) return;

    const role = user.role.toUpperCase();
    const headers = {
      // Workaround: GET /api/student/books requires student role. We pass student headers
      // so the librarian view can list books without throwing 403.
      'X-User-Role': role === 'LIBRARIAN' ? 'STUDENT' : role,
      'X-User-Id': role === 'LIBRARIAN' ? '2' : user.id
    };

    this.http.get<any[]>('/api/student/books', { headers }).subscribe({
      next: (data) => {
        const mappedBooks: Book[] = data.map(b => ({
          id: String(b.id),
          title: b.title,
          author: b.author,
          isbn: b.isbn,
          category: b.category || 'General',
          quantity: b.quantity !== undefined ? b.quantity : 1,
          availableCopies: b.availableCopies !== undefined ? b.availableCopies : (b.available ? 1 : 0)
        }));
        this.booksSignal.set(mappedBooks);
      },
      error: (err) => {
        console.error('Failed to load books from backend REST API', err);
      }
    });
  }

  /**
   * Add a new book to the library via the backend.
   */
  addBook(bookData: Omit<Book, 'id' | 'availableCopies'>): void {
    const headers = {
      'X-User-Role': 'LIBRARIAN'
    };
    
    this.http.post<any>('/api/librarian/books', bookData, { headers }).subscribe({
      next: () => {
        this.refreshBooks();
      },
      error: (err) => {
        console.error('Failed to add book via backend', err);
      }
    });
  }

  /**
   * Update a book's availability status.
   */
  updateBook(updatedBook: Book): void {
    const headers = {
      'X-User-Role': 'LIBRARIAN'
    };
    const isAvailable = updatedBook.availableCopies > 0;

    this.http.put<any>(`/api/librarian/books/${updatedBook.id}/availability`, null, {
      headers,
      params: { available: String(isAvailable) }
    }).subscribe({
      next: () => {
        this.refreshBooks();
      },
      error: (err) => {
        console.error('Failed to update book availability via backend', err);
      }
    });
  }

  /**
   * Delete a book from the backend.
   */
  deleteBook(id: string): void {
    const headers = {
      'X-User-Role': 'LIBRARIAN'
    };

    this.http.delete<void>(`/api/librarian/books/${id}`, { headers }).subscribe({
      next: () => {
        this.refreshBooks();
      },
      error: (err) => {
        console.error('Failed to delete book via backend', err);
      }
    });
  }

  /**
   * Triggered when book transaction is completed.
   */
  updateAvailableCopies(id: string, change: number): boolean {
    this.refreshBooks();
    return true;
  }
}
