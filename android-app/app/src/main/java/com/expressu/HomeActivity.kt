package com.expressu

import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.ListView
import androidx.appcompat.app.AppCompatActivity

class HomeActivity : AppCompatActivity() {
    private val sections = listOf("idea", "hobby", "learning", "moment", "book", "game")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_home)

        // All posts list
        val allPostsView = findViewById<ListView>(R.id.list_posts_all)
        val posts = StorageHelper.loadPosts(this, null).sortedByDescending { it.id }
        allPostsView.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, posts.map { "${it.title} (${it.section})" })
        allPostsView.setOnItemClickListener { _, _, position, _ ->
            val post = posts[position]
            val intent = Intent(this, PostDetailActivity::class.java)
            intent.putExtra("postId", post.id)
            intent.putExtra("section", post.section)
            startActivity(intent)
        }

        // Sections list
        val listView = findViewById<ListView>(R.id.list_sections)
        val adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, sections.map { it.replaceFirstChar { c -> c.uppercase() } })
        listView.adapter = adapter
        listView.setOnItemClickListener { _, _, position, _ ->
            val section = sections[position]
            val intent = Intent(this, SectionActivity::class.java)
            intent.putExtra("section", section)
            startActivity(intent)
        }
    }
}
