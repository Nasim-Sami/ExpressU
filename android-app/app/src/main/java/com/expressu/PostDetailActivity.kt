package com.expressu

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ListView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PostDetailActivity : AppCompatActivity() {
    private var postId: String = ""
    private var section: String = ""
    private var post: Post? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post_detail)

        postId = intent.getStringExtra("postId") ?: ""
        section = intent.getStringExtra("section") ?: ""

        findViewById<Button>(R.id.btn_add_chapter).setOnClickListener {
            val i = Intent(this, AddChapterActivity::class.java)
            i.putExtra("postId", postId)
            i.putExtra("section", section)
            startActivity(i)
        }

        findViewById<Button>(R.id.btn_import_media).setOnClickListener {
            val intent = Intent(Intent.ACTION_GET_CONTENT)
            intent.type = "*/*"
            startActivityForResult(Intent.createChooser(intent, "Select media"), 201)
        }

        findViewById<Button>(R.id.btn_edit_title).setOnClickListener {
            post?.let { p ->
                val input = android.widget.EditText(this)
                input.setText(p.title)
                android.app.AlertDialog.Builder(this)
                    .setTitle("Edit title")
                    .setView(input)
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Save") { _, _ ->
                        val newTitle = input.text.toString().trim()
                        if (newTitle.isNotEmpty()) {
                            val updated = p.copy(title = newTitle)
                            StorageHelper.savePost(this, updated)
                            post = updated
                            runOnUiThread { findViewById<TextView>(R.id.tv_title).text = newTitle }
                        }
                    }
                    .show()
            }
        }

        findViewById<Button>(R.id.btn_delete_post).setOnClickListener {
            // simple confirmation and delete
            val dlg = android.app.AlertDialog.Builder(this)
                .setTitle("Delete post")
                .setMessage("Are you sure you want to delete this post and its media?")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Delete") { _, _ ->
                    post?.let {
                        StorageHelper.deletePost(this, it)
                        finish()
                    }
                }
                .create()
            dlg.show()
        }
    }

    override fun onResume() {
        super.onResume()
        val posts = StorageHelper.loadPosts(this, listOf(section))
        post = posts.find { it.id == postId }
        val tv = findViewById<TextView>(R.id.tv_title)
        val listView = findViewById<ListView>(R.id.list_entries)
        if (post != null) {
            tv.text = post!!.title
            val adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, post!!.entries.map { it.title })
            listView.adapter = adapter
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 201 && resultCode == Activity.RESULT_OK) {
            data?.data?.let { uri ->
                CoroutineScope(Dispatchers.IO).launch {
                    val saved = StorageHelper.saveMediaToAppFiles(this@PostDetailActivity, postId, uri)
                    // create a simple entry that references the media
                    val entry = Entry(id = System.currentTimeMillis().toString(), title = "Imported media", body = "", mediaFiles = listOf(saved?.absolutePath ?: ""))
                    post?.let { StorageHelper.addEntryToPost(this@PostDetailActivity, it, entry) }
                    runOnUiThread { onResume() }
                }
            }
        }
    }
}
