package com.expressu

import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ListView
import androidx.appcompat.app.AppCompatActivity

class SectionActivity : AppCompatActivity() {
    private var section: String = "idea"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_section)

        section = intent.getStringExtra("section") ?: "idea"
        title = section.replaceFirstChar { it.uppercase() }

        val listView = findViewById<ListView>(R.id.list_posts)
        val addBtn = findViewById<Button>(R.id.btn_add_post)

        addBtn.setOnClickListener {
            val i = Intent(this, AddPostActivity::class.java)
            i.putExtra("section", section)
            startActivity(i)
        }
    }

    override fun onResume() {
        super.onResume()
        val posts = StorageHelper.loadPosts(this, listOf(section))
        val adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, posts.map { it.title })
        val listView = findViewById<ListView>(R.id.list_posts)
        listView.adapter = adapter
        listView.setOnItemClickListener { _, _, position, _ ->
            val post = posts[position]
            val intent = Intent(this, PostDetailActivity::class.java)
            intent.putExtra("postId", post.id)
            intent.putExtra("section", post.section)
            startActivity(intent)
        }
    }
}
