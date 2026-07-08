# 📊 Database Schema Documentation

## Table: book_issues

| Column | Type | PK | Nullable |
| :--- | :--- | :--- | :--- |
| **id** | bigint | YES | NO |
| **book_id** | bigint | | NO |
| **due_date** | date | | NO |
| **issue_date**| date | | NO |
| **return_date**| date | | YES |
| **student_id** | bigint | | NO |


## Table: books

| Column | Type | PK | Nullable |
| :--- | :--- | :--- | :--- |
| **id** | bigint | YES | NO |
| **author** | varchar(255) | | NO |
| **available** | bit(1) | | NO |
| **isbn**| varchar(255) | | NO |
| **tag**| varchar(255) | | NO |
| **title** | varchar(255) | | NO |


## Table: users

| Column | Type | PK | Nullable |
| :--- | :--- | :--- | :--- |
| **id** | bigint | YES | NO |
| **role** | varchar(255) | | NO |
| **username** | varchar(255) | | NO |