package com.expressu

import android.os.Bundle
import android.content.Intent
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SearchActivity : AppCompatActivity() {
    private val allSections = listOf("All", "idea", "hobby", "learning", "moment", "book", "game")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_search)

        val spinner = findViewById<Spinner>(R.id.spinner_sections)
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, allSections.map { it.capitalize() })
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinner.adapter = adapter

        val queryEdit = findViewById<EditText>(R.id.edit_query)
        val btnSearch = findViewById<Button>(R.id.btn_search)
        val listView = findViewById<ListView>(R.id.list_results)

        btnSearch.setOnClickListener {
            val q = queryEdit.text.toString()
            val selected = allSections[spinner.selectedItemPosition]
            val sections = if (selected == "All") null else listOf(selected)
            CoroutineScope(Dispatchers.IO).launch {
                val results = StorageHelper.search(this@SearchActivity, q, sections)
                runOnUiThread {
                    listView.adapter = ArrayAdapter(this@SearchActivity, android.R.layout.simple_list_item_1, results.map { "${it.title} (${it.section})" })
                    listView.setOnItemClickListener { _, _, position, _ ->
                        val post = results[position]
                        val intent = Intent(this@SearchActivity, PostDetailActivity::class.java)
                        intent.putExtra("postId", post.id)
                        intent.putExtra("section", post.section)
                        startActivity(intent)
                    }
                }
            }
        }
    }
}
