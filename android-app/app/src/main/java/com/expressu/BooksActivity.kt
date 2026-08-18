package com.expressu

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class BooksActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_books)
        // PDF viewer integration can be added later. This placeholder lists uploaded books.
    }
}
