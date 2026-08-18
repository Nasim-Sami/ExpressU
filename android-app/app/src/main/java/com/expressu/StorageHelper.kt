package com.expressu

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import java.io.File
import java.io.FileOutputStream

object StorageHelper {
    private val gson: Gson = GsonBuilder().setPrettyPrinting().create()

    // Save a media Uri into app-specific external files directory under media/<postId>/
    fun saveMediaToAppFiles(context: Context, postId: String, uri: Uri): File? {
        val resolver: ContentResolver = context.contentResolver
        val mediaDir = File(context.getExternalFilesDir(null), "media/$postId")
        mediaDir.mkdirs()
        val fileName = uri.lastPathSegment?.substringAfterLast('/') ?: "media_${System.currentTimeMillis()}"
        val dest = File(mediaDir, fileName)
        resolver.openInputStream(uri)?.use { input ->
            FileOutputStream(dest).use { out ->
                input.copyTo(out)
            }
        } ?: return null
        return dest
    }

    // Save a Post as a JSON file under posts/<section>/<id>.json
    fun savePost(context: Context, post: Post) {
        val postsDir = File(context.filesDir, "posts/${post.section}")
        postsDir.mkdirs()
        val file = File(postsDir, "${post.id}.json")
        val text = gson.toJson(post)
        file.writeText(text)
    }

    // Delete a post and its media
    fun deletePost(context: Context, post: Post) {
        val postsDir = File(context.filesDir, "posts/${post.section}")
        val file = File(postsDir, "${post.id}.json")
        if (file.exists()) file.delete()
        // delete media folder
        val mediaDir = File(context.getExternalFilesDir(null), "media/${post.id}")
        if (mediaDir.exists()) mediaDir.deleteRecursively()
    }

    // Add an entry/chapter to an existing post
    fun addEntryToPost(context: Context, post: Post, entry: Entry) {
        val updated = post.copy(entries = post.entries + entry)
        savePost(context, updated)
    }

    // Load all posts (or in specific sections)
    fun loadPosts(context: Context, sections: List<String>? = null): List<Post> {
        val base = File(context.filesDir, "posts")
        if (!base.exists()) return emptyList()
        val sectionsToLoad = sections ?: base.listFiles()?.map { it.name } ?: emptyList()
        val out = mutableListOf<Post>()
        for (s in sectionsToLoad) {
            val dir = File(base, s)
            if (!dir.exists()) continue
            dir.listFiles()?.forEach { f ->
                try {
                    val p = gson.fromJson(f.readText(), Post::class.java)
                    out.add(p)
                } catch (_: Exception) {
                }
            }
        }
        return out
    }

    // Simple search across selected sections (title + entries' title/body)
    fun search(context: Context, query: String, sections: List<String>? = null): List<Post> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return emptyList()
        return loadPosts(context, sections).filter { p ->
            p.title.lowercase().contains(q) || p.entries.any { e -> e.title.lowercase().contains(q) || e.body.lowercase().contains(q) }
        }
    }
}
