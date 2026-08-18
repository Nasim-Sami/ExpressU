package com.expressu

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity

class AddPostActivity : AppCompatActivity() {
    private var section: String = "idea"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_add_post)

        section = intent.getStringExtra("section") ?: "idea"

        val titleEdit = findViewById<EditText>(R.id.edit_title)
        val btnCreate = findViewById<Button>(R.id.btn_create_post)
        btnCreate.setOnClickListener {
            val title = titleEdit.text.toString().trim()
            if (title.isNotEmpty()) {
                val id = System.currentTimeMillis().toString()
                val post = Post(id = id, section = section, title = title, entries = emptyList())
                StorageHelper.savePost(this, post)
                finish()
            }
        }
    }
}
