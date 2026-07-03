import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LibraryService } from '../../services/library.service';
import { BookService } from '../../services/book.service';
import { UserService } from '../../services/user.service';

interface CategoryReport {
  category: string;
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  issuedCopies: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html'
})
export class ReportsComponent {
  libraryService = inject(LibraryService);
  bookService = inject(BookService);
  userService = inject(UserService);

  currentUser = this.userService.currentUser;

  // 1. Category Wise Report
  categoryReports = computed<CategoryReport[]>(() => {
    const books = this.bookService.books();
    const categoriesMap = new Map<string, { totalTitles: number, totalCopies: number, availableCopies: number }>();

    books.forEach(book => {
      const existing = categoriesMap.get(book.category) || { totalTitles: 0, totalCopies: 0, availableCopies: 0 };
      categoriesMap.set(book.category, {
        totalTitles: existing.totalTitles + 1,
        totalCopies: existing.totalCopies + book.quantity,
        availableCopies: existing.availableCopies + book.availableCopies
      });
    });

    const reports: CategoryReport[] = [];
    categoriesMap.forEach((val, key) => {
      reports.push({
        category: key,
        totalTitles: val.totalTitles,
        totalCopies: val.totalCopies,
        availableCopies: val.availableCopies,
        issuedCopies: val.totalCopies - val.availableCopies
      });
    });
    return reports;
  });

  // 2. Overdue Books Listing (Global or User specific depending on role)
  overdueRecords = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    const user = this.currentUser();
    if (!user) return [];

    let activeIssues = this.libraryService.issuedBooks().filter(ib => !ib.returnDate && ib.dueDate < today);

    // If Student or Teacher, filter only their own overdue books
    if (user.role !== 'Librarian') {
      activeIssues = activeIssues.filter(ib => ib.userId === user.id);
    }

    return activeIssues.map(rec => {
      const book = this.bookService.books().find(b => b.id === rec.bookId);
      const borrower = this.userService.users().find(u => u.id === rec.userId);
      const currentFine = this.libraryService.calculateFine(rec.issueDate);
      return {
        ...rec,
        bookTitle: book ? book.title : 'Unknown Book',
        bookAuthor: book ? book.author : 'Unknown Author',
        borrowerName: borrower ? borrower.name : 'Unknown User',
        borrowerEmail: borrower ? borrower.email : 'Unknown Email',
        currentFine
      };
    });
  });

  // 3. Fines Summary Reports
  collectedFines = computed(() => {
    return this.libraryService.issuedBooks()
      .filter(ib => !!ib.returnDate && !!ib.finePaid)
      .reduce((sum, ib) => sum + (ib.fineAmount || 0), 0);
  });

  uncollectedFines = computed(() => {
    return this.libraryService.issuedBooks()
      .filter(ib => !ib.returnDate)
      .reduce((sum, ib) => sum + this.libraryService.calculateFine(ib.issueDate), 0);
  });
}
