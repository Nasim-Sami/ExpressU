package com.expressu

import android.os.Bundle
import android.content.Intent
import android.widget.ArrayAdapter
import android.widget.ListView
import androidx.appcompat.app.AppCompatActivity

class ProfileActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profile)
    }

    override fun onResume() {
        super.onResume()
        val posts = StorageHelper.loadPosts(this, null)
        val listView = findViewById<ListView>(R.id.list_my_posts)
        listView.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, posts.map { "${it.title} (${it.section})" })
        listView.setOnItemClickListener { _, _, position, _ ->
            val post = posts[position]
            val intent = Intent(this, PostDetailActivity::class.java)
            intent.putExtra("postId", post.id)
            intent.putExtra("section", post.section)
            startActivity(intent)
        }
    }
}
