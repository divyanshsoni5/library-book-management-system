package com.librarymanagement.library_management.model;

import jakarta.persistence.*;

@Entity
@Table(name = "books")
public class Book {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String author;

    @Column(nullable = false, unique = true)
    private String isbn;

    @Column(nullable = false)
    private boolean available = true;

    @Column(nullable = false)
    private String tag = "AVAILABLE"; // "AVAILABLE", "ISSUED", "UNAVAILABLE"

    private String category = "General";

    private Integer quantity = 1;

    private Integer availableCopies = 1;

    public Book() {}

    public Book(String title, String author, String isbn) {
        this.title = title;
        this.author = author;
        this.isbn = isbn;
        this.available = true;
        this.tag = "AVAILABLE";
        this.category = "General";
        this.quantity = 1;
        this.availableCopies = 1;
    }

    public Book(String title, String author, String isbn, String category, Integer quantity) {
        this.title = title;
        this.author = author;
        this.isbn = isbn;
        this.category = category != null ? category : "General";
        this.quantity = quantity != null ? quantity : 1;
        this.availableCopies = this.quantity;
        this.available = this.quantity > 0;
        this.tag = this.quantity > 0 ? "AVAILABLE" : "UNAVAILABLE";
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getIsbn() {
        return isbn;
    }

    public void setIsbn(String isbn) {
        this.isbn = isbn;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        this.tag = tag;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public Integer getAvailableCopies() {
        return availableCopies;
    }

    public void setAvailableCopies(Integer availableCopies) {
        this.availableCopies = availableCopies;
    }
}
