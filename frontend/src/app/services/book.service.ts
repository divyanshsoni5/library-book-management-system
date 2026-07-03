import { Injectable, signal } from '@angular/core';
import { Book } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class BookService {
  private readonly STORAGE_KEY = 'lms_books';
  
  // Initial default mock books
  private defaultBooks: Book[] = [
    {
      id: 'book-1',
      title: 'Introduction to Algorithms',
      author: 'Thomas H. Cormen',
      category: 'Computer Science',
      isbn: '9780262033848',
      quantity: 5,
      availableCopies: 3
    },
    {
      id: 'book-2',
      title: 'Database System Concepts',
      author: 'Abraham Silberschatz',
      category: 'Information Technology',
      isbn: '9780073523309',
      quantity: 3,
      availableCopies: 2
    },
    {
      id: 'book-3',
      title: 'Microelectronic Circuits',
      author: 'Adel S. Sedra',
      category: 'Electronics & TC',
      isbn: '9780199339136',
      quantity: 2,
      availableCopies: 1
    },
    {
      id: 'book-4',
      title: 'Power System Analysis',
      author: 'Hadi Saadat',
      category: 'Electrical Engineering',
      isbn: '9780984543823',
      quantity: 4,
      availableCopies: 4
    },
    {
      id: 'book-5',
      title: 'Engineering Mechanics: Statics',
      author: 'J.L. Meriam',
      category: 'Mechanical Engineering',
      isbn: '9781118807330',
      quantity: 6,
      availableCopies: 5
    }
  ];

  // Writable signal holding the state of books
  private booksSignal = signal<Book[]>(this.loadBooks());

  // Exposed read-only signal for components to consume
  books = this.booksSignal.asReadonly();

  constructor() {}

  /**
   * Load books from localStorage or return default mock books.
   */
  private loadBooks(): Book[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse books from localStorage, using defaults', e);
      }
    }
    // Save defaults to localStorage for first run
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.defaultBooks));
    return this.defaultBooks;
  }

  /**
   * Save current books signal value to localStorage.
   */
  private saveBooks(books: Book[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(books));
    this.booksSignal.set(books);
  }

  /**
   * Add a new book to the library.
   */
  addBook(bookData: Omit<Book, 'id' | 'availableCopies'>): void {
    const newBook: Book = {
      ...bookData,
      id: `book-${Date.now()}`,
      availableCopies: bookData.quantity // Initially all copies are available
    };
    const updated = [...this.booksSignal(), newBook];
    this.saveBooks(updated);
  }

  /**
   * Update an existing book.
   * Adjusts available copies based on the change in total quantity.
   */
  updateBook(updatedBook: Book): void {
    const currentBooks = this.booksSignal();
    const index = currentBooks.findIndex(b => b.id === updatedBook.id);
    
    if (index !== -1) {
      const oldBook = currentBooks[index];
      // Calculate how many copies are currently issued
      const issuedCopies = oldBook.quantity - oldBook.availableCopies;
      
      // The new available copies should be total quantity minus issued copies.
      // Ensure available copies doesn't fall below zero.
      const newAvailableCopies = Math.max(0, updatedBook.quantity - issuedCopies);
      
      const newBook: Book = {
        ...updatedBook,
        availableCopies: newAvailableCopies
      };
      
      const updated = [...currentBooks];
      updated[index] = newBook;
      this.saveBooks(updated);
    }
  }

  /**
   * Delete a book from the list.
   */
  deleteBook(id: string): void {
    const updated = this.booksSignal().filter(b => b.id !== id);
    this.saveBooks(updated);
  }

  /**
   * Update available copies (e.g. +/- 1 when issued or returned).
   */
  updateAvailableCopies(id: string, change: number): boolean {
    const currentBooks = this.booksSignal();
    const index = currentBooks.findIndex(b => b.id === id);
    
    if (index !== -1) {
      const book = currentBooks[index];
      const newAvailable = book.availableCopies + change;
      
      if (newAvailable >= 0 && newAvailable <= book.quantity) {
        const updated = [...currentBooks];
        updated[index] = {
          ...book,
          availableCopies: newAvailable
        };
        this.saveBooks(updated);
        return true;
      }
    }
    return false;
  }
}
