import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LibraryService } from '../../services/library.service';
import { UserService } from '../../services/user.service';
import { BookService } from '../../services/book.service';
import { IssuedBook } from '../../models/models';

@Component({
  selector: 'app-return-book',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './return-book.html'
})
export class ReturnBookComponent {
  libraryService = inject(LibraryService);
  userService = inject(UserService);
  bookService = inject(BookService);

  // Modal controls
  isModalOpen = false;
  selectedRecord: IssuedBook | null = null;
  fineAmount = 0;
  daysKept = 0;

  // Active issued books (not returned yet)
  activeIssuedBooks = computed(() => {
    return this.libraryService.issuedBooks().filter(ib => !ib.returnDate);
  });

  /**
   * Helper to lookup user name by ID
   */
  getUserName(userId: string): string {
    const user = this.userService.users().find(u => u.id === userId);
    return user ? user.name : 'Unknown User';
  }

  /**
   * Helper to lookup user email by ID
   */
  getUserEmail(userId: string): string {
    const user = this.userService.users().find(u => u.id === userId);
    return user ? user.email : '';
  }

  /**
   * Helper to lookup book title by ID
   */
  getBookTitle(bookId: string): string {
    const book = this.bookService.books().find(b => b.id === bookId);
    return book ? book.title : 'Unknown Book';
  }

  /**
   * Calculate current fine for a book
   */
  getFine(issueDateStr: string): number {
    return this.libraryService.calculateFine(issueDateStr);
  }

  /**
   * Open confirmation return modal, calculating fine and days kept.
   */
  openReturnModal(record: IssuedBook): void {
    this.selectedRecord = record;
    const today = new Date();
    const issueDate = new Date(record.issueDate);
    issueDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - issueDate.getTime();
    this.daysKept = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    this.fineAmount = this.libraryService.calculateFine(record.issueDate);
    this.isModalOpen = true;
  }

  /**
   * Close modal.
   */
  closeModal(): void {
    this.isModalOpen = false;
    this.selectedRecord = null;
  }

  /**
   * Complete the return process.
   */
  confirmReturn(collectFine: boolean): void {
    if (this.selectedRecord) {
      this.libraryService.returnBook(this.selectedRecord, collectFine).subscribe(success => {
        if (success) {
          this.closeModal();
        }
      });
    }
  }
}
