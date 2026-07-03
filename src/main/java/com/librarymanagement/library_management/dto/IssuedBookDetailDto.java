package com.librarymanagement.library_management.dto;

import java.time.LocalDate;

public class IssuedBookDetailDto {
    private Long bookId;
    private String bookTitle;
    private String author;
    private LocalDate issueDate;
    private LocalDate dueDate;
    private long daysOverdue;
    private double fine;

    public IssuedBookDetailDto() {}

    public IssuedBookDetailDto(Long bookId, String bookTitle, String author, LocalDate issueDate, LocalDate dueDate, long daysOverdue, double fine) {
        this.bookId = bookId;
        this.bookTitle = bookTitle;
        this.author = author;
        this.issueDate = issueDate;
        this.dueDate = dueDate;
        this.daysOverdue = daysOverdue;
        this.fine = fine;
    }

    public Long getBookId() {
        return bookId;
    }

    public void setBookId(Long bookId) {
        this.bookId = bookId;
    }

    public String getBookTitle() {
        return bookTitle;
    }

    public void setBookTitle(String bookTitle) {
        this.bookTitle = bookTitle;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public LocalDate getIssueDate() {
        return issueDate;
    }

    public void setIssueDate(LocalDate issueDate) {
        this.issueDate = issueDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public long getDaysOverdue() {
        return daysOverdue;
    }

    public void setDaysOverdue(long daysOverdue) {
        this.daysOverdue = daysOverdue;
    }

    public double getFine() {
        return fine;
    }

    public void setFine(double fine) {
        this.fine = fine;
    }
}
