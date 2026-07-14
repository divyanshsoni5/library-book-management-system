import { Component, inject, signal, computed, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookService } from '../../services/book.service';
import { Book } from '../../models/models';

interface BookForm {
  id?: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  quantity: number;
}

@Component({
  selector: 'app-books-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './books-list.html'
})
export class BooksListComponent {
  bookService = inject(BookService);
  private cdr = inject(ChangeDetectorRef);
  
  @Input() role: 'Student' | 'Faculty' | 'Librarian' = 'Student';

  // Signals for searching
  searchQuery = signal<string>('');

  // Computed signal to instantly filter books by title or author
  filteredBooks = computed(() => {
    const books = this.bookService.books();
    const query = this.searchQuery().toLowerCase().trim();
    
    if (!query) {
      return books;
    }
    
    return books.filter(book => 
      book.title.toLowerCase().includes(query) || 
      book.author.toLowerCase().includes(query)
    );
  });

  // Modal control variables
  isModalOpen = false;
  isEditMode = false;
  modalTitle = 'Add New Book';
  
  // Book Form model
  bookForm: BookForm = this.resetForm();

  /**
   * Reset form values to default empty state.
   */
  private resetForm(): BookForm {
    return {
      title: '',
      author: '',
      category: '',
      isbn: '',
      quantity: 1
    };
  }

  /**
   * Open the modal in "Add" mode.
   */
  openAddModal(): void {
    this.isEditMode = false;
    this.modalTitle = 'Add New Book';
    this.bookForm = this.resetForm();
    this.isModalOpen = true;
  }

  /**
   * Open the modal in "Edit" mode and pre-populate the form.
   */
  openEditModal(book: Book): void {
    this.isEditMode = true;
    this.modalTitle = 'Edit Book';
    this.bookForm = {
      id: book.id,
      title: book.title,
      author: book.author,
      category: book.category,
      isbn: book.isbn,
      quantity: book.quantity
    };
    this.isModalOpen = true;
  }

  /**
   * Close the active modal.
   */
  closeModal(): void {
    this.isModalOpen = false;
  }

  /**
   * Save the book (handles both add and update).
   */
  saveBook(): void {
    if (this.isEditMode && this.bookForm.id) {
      // Find current book to keep other properties (e.g. availableCopies is updated in service)
      const currentBook = this.bookService.books().find(b => b.id === this.bookForm.id);
      if (currentBook) {
        const updatedBook: Book = {
          ...currentBook,
          title: this.bookForm.title,
          author: this.bookForm.author,
          category: this.bookForm.category,
          isbn: this.bookForm.isbn,
          quantity: this.bookForm.quantity
        };
        this.bookService.updateBook(updatedBook).subscribe({
          next: () => {
            this.cdr.detectChanges();
          },
          error: err => console.error('Save updated book failed', err)
        });
      }
    } else {
      this.bookService.addBook({
        title: this.bookForm.title,
        author: this.bookForm.author,
        category: this.bookForm.category,
        isbn: this.bookForm.isbn,
        quantity: this.bookForm.quantity
      }).subscribe({
        next: () => {
          this.cdr.detectChanges();
        },
        error: err => console.error('Save new book failed', err)
      });
    }
    this.closeModal();
  }

  /**
   * Delete a book after confirmation.
   */
  deleteBook(id: string): void {
    if (confirm('Are you sure you want to delete this book from the library?')) {
      this.bookService.deleteBook(id).subscribe({
        next: () => {
          this.cdr.detectChanges();
        },
        error: err => console.error('Delete book failed', err)
      });
    }
  }
}
