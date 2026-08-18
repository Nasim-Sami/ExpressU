package com.expressu

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AddChapterActivity : AppCompatActivity() {
    private var postId: String = ""
    private var section: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_add_chapter)

        postId = intent.getStringExtra("postId") ?: ""
        section = intent.getStringExtra("section") ?: ""

        val titleEdit = findViewById<EditText>(R.id.edit_chapter_title)
        val bodyEdit = findViewById<EditText>(R.id.edit_chapter_body)
        val btnCreate = findViewById<Button>(R.id.btn_create_chapter)

        btnCreate.setOnClickListener {
            val title = titleEdit.text.toString().trim()
            val body = bodyEdit.text.toString().trim()
            if (title.isNotEmpty()) {
                CoroutineScope(Dispatchers.IO).launch {
                    val posts = StorageHelper.loadPosts(this@AddChapterActivity, listOf(section))
                    val post = posts.find { it.id == postId }
                    if (post != null) {
                        val entry = Entry(id = System.currentTimeMillis().toString(), title = title, body = body)
                        StorageHelper.addEntryToPost(this@AddChapterActivity, post, entry)
                    }
                    runOnUiThread { finish() }
                }
            }
        }
    }
}
